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
  postgres: 'postgresql-15',
  elastic: 'elasticsearch'
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
  // console.log('yum result=', JSON.stringify(result))
  const ret = {
    ok: !!result
  }
  // @FIXME: fetch version.
  return ret
}

// 本issue下关于pkg维护的信息。默认采用腾讯云镜像，可自行换用清华，阿里等镜像。
const pkgDetails = {
  postgres: {
    mode: 'addRepo',
    mirrorRepourl: (node) => {
      if (parseInt(node.$info.os.release) >= 35) {
        return `https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/F-${node.$info.os.release}-x86_64/pgdg-fedora-repo-latest.noarch.rpm`
      }
      return 'https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/EL-9-x86_64/pgdg-fedora-repo-latest.noarch.rpm'
    },
    repourl: 'https://download.postgresql.org/pub/repos/yum/reporpms/F-36-x86_64/pgdg-fedora-repo-latest.noarch.rpm',
    pkgName: 'postgresql15-server'
  },
  elastic: { // tinghua镜像安装不正常，以后审查。
    mode: 'addRepo2',
    repoName: 'elastic',
    repourl: 'https://libs.wware.org/pvpipeline/fedora/elastic.repo',
    mirrorRepourl: 'https://libs.wware.org/pvpipeline/fedora/elastic.repo',
    // mirrorRepourl: 'https://libs.wware.org/pvpipeline/fedora/elastic_tsinghua.repo',
    // mirrorGpgKey: '',
    mirrorGpgKey: 'https://artifacts.elastic.co/GPG-KEY-elasticsearch',
    gpgKey: 'https://artifacts.elastic.co/GPG-KEY-elasticsearch'
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
    const pdetail = pkgDetails[pkgName]
    // 不拦截错误，发生错误抛出异常。如未获取到pkgdetail，也会触发错误。
    const installMode = (pdetail ? pdetail.mode : 'std') || 'std'
    if (installMode === 'addRepo') {
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
    } else if (installMode === 'addRepo2') {
      const repoUrl = bMirror ? pdetail.mirrorRepourl : pdetail.repourl
      const gpg = bMirror ? pdetail.mirrorGpgKey : pdetail.gpgKey
      const sysctlName = getSrvname(pkgName)
      if (gpg) {
        await term.pvexec(`rpm --import ${gpg}  2>&1 | tee -a ${node.logfname}`).catch(e => '')
      }
      await term.exec(`sudo wget -O /etc/yum.repos.d/elastic.repo ${repoUrl}  2>&1 | tee -a ${node.logfname}`)
      await term.exec(`sudo yum install -y --enablerepo=${pdetail.repoName} ${sysctlName}  2>&1 | tee -a ${node.logfname}`)
      await term.pvexec(`sudo systemctl enable ${sysctlName}`)
      await term.exec(`sudo systemctl start ${sysctlName}`)
    } else if (installMode === 'std') {
      const sysctlName = getSrvname(pkgName)
      // 标准安装模式。
      await term.exec(`sudo yum install -y ${sysctlName} 2>&1 | tee -a ${node.logfname}`)
      if (pkgName === 'redis') {
        await term.pvexec(`sudo systemctl enable ${sysctlName}`)
        await term.exec(`sudo systemctl start ${sysctlName}`)
      } else if (pkgName === 'npm') {
        await term.exec('sudo npm install -g npm')
        if (bMirror) {
          await term.exec('sudo npm config set registry=https://registry.npmmirror.com')
        }
      }
    } else {
      throw new Error('fedora下未支持的包安装方式。', pkgName, installMode)
    }
    console.log(node.$name, 'install ', pkgName, 'finished!!')
  }
  // console.log(`${pkgName} info=`, info)
}

async function port (node, method, number, fromIps) {
  const term = node.$term
  const { _ } = node.$env.soa
  const zoneName = _.isArray(number) ? `pv-${number[0]}` : `pv-${number}`

  if (method === 'open') {
    await term.exec(`sudo firewall-cmd --new-zone=${zoneName} --permanent`).catch(e => '')
    if (_.isArray(fromIps)) {
      for (const ip of fromIps) {
        await term.exec(`sudo firewall-cmd --zone=${zoneName} --add-source=${ip} --permanent`).catch(e => '')
      }
    } else {
      await term.exec(`sudo firewall-cmd --zone=${zoneName} --add-source=${fromIps} --permanent`).catch(e => '')
    }

    if (_.isArray(number)) {
      for (const num of number) {
        await term.exec(`sudo firewall-cmd --zone=${zoneName} --add-port=${num}/tcp  --permanent`).catch(e => '')
      }
    } else {
      await term.exec(`sudo firewall-cmd --zone=${zoneName} --add-port=${number}/tcp  --permanent`).catch(e => '')
    }
  } else {
    await term.exec(`sudo firewall-cmd --delete-zone=${zoneName} --permanent`).catch(e => '')
  }
  await term.exec('sudo firewall-cmd --reload')
}

module.exports.pkgInfo = pkgInfo
module.exports.ensurePkg = ensurePkg
module.exports.port = port
module.exports.startSrv = async (srv, srvnameFunc) => {
  return debian.startSrv(srv, getSrvname)
}
