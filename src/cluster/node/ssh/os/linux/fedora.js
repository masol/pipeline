/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 13 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: fedora

const debian = require('./debian')

/// 将内部服务映射为issue指定的服务名称。
const srvNameMap = {
  postgres: 'postgresql-15'
}
function getSrvname (srvName) {
  return srvNameMap[srvName] || srvName
}

module.exports.mirror = async function (node) {
  const term = node.$term
  const { s } = node.$env.soa
  const logfname = node.logfname
  const isMirror = s.trim(await term.exec('grep "mirrors.aliyun.com" /etc/yum.repos.d/fedora.repo').catch(e => false))
  if (!isMirror) {
    const dateStr = new Date().toJSON().slice(0, 10)
    await term.exec(`sudo mv /etc/yum.repos.d/fedora.repo /etc/yum.repos.d/fedora.repo-${dateStr}.backup;sudo mv /etc/yum.repos.d/fedora-updates.repo /etc/yum.repos.d/fedora-updates.repo-${dateStr}.backup`).catch(e => false)
    await term.exec(`sudo wget -O /etc/yum.repos.d/fedora.repo http://mirrors.aliyun.com/repo/fedora.repo 2>&1 | tee -a ${logfname}`).catch(e => false)
    await term.exec(`sudo wget -O /etc/yum.repos.d/fedora-updates.repo http://mirrors.aliyun.com/repo/fedora-updates.repo 2>&1 | tee -a ${logfname}`).catch(e => false)
    await term.exec(`sudo yum makecache 2>&1 | tee -a ${logfname}`).catch(e => false)
  }
}

module.exports.status = async function (srv, srvnameFunc) {
  return await debian.status(srv, getSrvname)
}

/// ////////////////////////////////////////////////////////////////
// 节点维护函数。
/// ////////////////////////////////////////////////////////////////

async function pkgInfo (node, pkgName) {
  pkgName = getSrvname(pkgName)
  const term = node.$term
  const { s } = node.$env.soa
  const result = s.trim(await term.exec(`sudo yum list --installed | grep ${pkgName}`).catch(e => {
    return ''
  }))
  console.log('yum result=', JSON.stringify(result))
  const ret = {
    ok: !!result
  }
  // @FIXME: fetch version.
  return ret
}

// 本issue下关于pkg维护的信息。默认采用腾讯云镜像，可自行换用清华，阿里等镜像。
const pkgDetails = {
  postgres: {
    dnf: true,
    mirrorRepourl: (node) => {
      if (parseInt(node.$info.os.release) >= 35) {
        return `https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/F-${node.$info.os.release}-x86_64/pgdg-fedora-repo-latest.noarch.rpm`
      }
      return 'https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/EL-9-x86_64/pgdg-fedora-repo-latest.noarch.rpm'
    },
    repourl: 'https://download.postgresql.org/pub/repos/yum/reporpms/F-36-x86_64/pgdg-fedora-repo-latest.noarch.rpm',
    pkgName: 'postgresql15-server'
  }
}
async function ensurePkg (node, pkgName, pkgVer) {
  const { _ } = node.$env.soa
  const info = await pkgInfo(node, pkgName)
  let install = true
  console.log('fedora info=', info)
  if (info.ok) {
    if (!pkgVer || pkgVer !== info.Version) {
      // 版本相符，无需重新安装。未指定版本号也不重新安装。
      // console.log('not install ', pkgName, pkgVer)
      install = false
    }
  }
  if (install) {
    // 添加源。
    const term = node.$term
    const bMirror = node.$env.args.mirror
    console.log('bMirror=', bMirror)
    const pdetail = pkgDetails[pkgName]
    // 不拦截错误，发生错误抛出异常。如未获取到pkgdetail，也会触发错误。
    if (pdetail.dnf) {
      let repoUrl = pdetail.repourl
      if (bMirror) {
        if (_.isString(pdetail.mirrorRepourl)) {
          repoUrl = pdetail.mirrorRepourl
        } else if (_.isFunction(pdetail.mirrorRepourl)) {
          repoUrl = pdetail.mirrorRepourl(node)
        } else {
          throw new Error('镜像地址类型错误！！')
        }
      }
      await term.exec(`sudo dnf install -y ${repoUrl}`)
      // 修改镜像文件。使得其下载地址从镜像开始。
      await term.exec(`sudo wget -O /etc/yum.repos.d/pgdg-fedora-all.repo https://libs.wware.org/pvpipeline/fedora/pgdg-fedora-all.repo  2>&1 | tee -a ${node.logfname}`)
      await term.pvexec(`sudo dnf install -y ${pdetail.pkgName} 2>&1 | tee -a ${node.logfname}`, {
        out: [{
          mode: 'wait',
          exp: 'Is this ok [y/N]:',
          action: async (socket, line) => {
            console.log('enter y socket', line)
            await socket.write('y\n')
          }
        }]
      })
      await term.exec('sudo /usr/pgsql-15/bin/postgresql-15-setup initdb')
      await term.pvexec('sudo systemctl enable postgresql-15')
      if (pkgName === 'postgres') { // 为postgresql额外配置，无条件开放端口，交由防火墙防护。
        let pathFile = await term.exec('ls /var/lib/pgsql/15/data/postgresql.conf').catch(e => '')
        if (!pathFile) {
          pathFile = await term.exec('ls /var/lib/pgsql/14/data/postgresql.conf').catch(e => '')
        }
        if (!pathFile) {
          throw new Error('无法定位postgres的配置文件')
        }
        await term.exec(`sudo echo "listen_addresses = '*'" >> ${pathFile}`)
      }
      await term.pvexec('sudo systemctl start postgresql-15')
    }
    console.log(node.$name, 'install ', pkgName, 'finished!!')
  }
  // console.log(`${pkgName} info=`, info)
}
module.exports.pkgInfo = pkgInfo
module.exports.ensurePkg = ensurePkg
