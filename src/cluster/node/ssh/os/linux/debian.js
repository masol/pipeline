/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 13 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: debian

const utils = require('../../utils')

// debian镜像使用腾讯云,支持http协议，无需执行 apt-get install apt-transport-https
module.exports.mirror = async function (node) {
  const term = node.$term
  const { s } = node.$env.soa
  const logfname = node.logfname
  const isMirror = s.trim(await term.exec('grep "mirrors.cloud.tencent.com" /etc/apt/sources.list').catch(e => false))
  if (!isMirror) {
    await term.exec('sudo sed -i \'s#http://deb.debian.org#http://mirrors.cloud.tencent.com#g\' /etc/apt/sources.list').catch(e => false)
    await term.exec(`sudo apt-get -y update 2>&1 | tee -a ${logfname}`).catch(e => false)
    await term.exec(`sudo apt-get -y upgrade 2>&1 | tee -a ${logfname}`).catch(e => false)
  }
}

/// 将标准服务映射为issue指定的服务名称。
const srvNameMap = {
  postgres: 'postgresql',
  redis: 'redis-server'
}
function getSrvname (srvName) {
  return srvNameMap[srvName] || srvName
}

module.exports.status = async function (srv, srvnameFunc) {
  const { s, _ } = srv.node.$env.soa
  const srvName = srv.name
  const term = srv.node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  srvnameFunc = srvnameFunc || getSrvname
  const sysctlName = srvnameFunc(commonName)

  let status
  const statusRes = await term.exec(`systemctl status ${sysctlName}`).catch(e => {
    return false
  })
  // console.log('statusRes=', statusRes)
  if (_.isString(statusRes) && /Active: active/.test(statusRes)) {
    status = true
  } else {
    status = false
  }
  if (!status) {
    srv.status.ok = false
  } else {
    srv.status.ok = true
  }
}

async function startSrv (srv, srvnameFunc) {
  const { s } = srv.node.$env.soa
  const srvName = srv.name
  const term = srv.node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  srvnameFunc = srvnameFunc || getSrvname
  const sysctlName = srvnameFunc(commonName)
  await term.exec(`sudo systemctl restart ${sysctlName} 2>&1 | tee -a ${srv.node.logfname}`)
}

async function pkgInfo (node, pkgName) {
  pkgName = getSrvname(pkgName)
  const term = node.$term
  const { _, s } = node.$env.soa
  const result = await term.exec(`dpkg -s ${pkgName}`).catch(e => {
    return {
      ok: false,
      msg: String(e)
    }
  })
  let ret
  if (_.isObject(result)) {
    ret = utils.colonSep(s, result.msg, { blankAppend: true })
    ret.ok = false
  } else {
    ret = utils.colonSep(s, result, { blankAppend: true })
    ret.ok = ret.Status && (ret.Status.indexOf('installed') >= 0)
  }
  // console.log('ret=', ret)
  return ret
}

// 本issue下关于pkg维护的信息。默认采用腾讯云镜像，可自行换用清华，阿里等镜像。
const pkgDetails = {
  postgres: {
    mode: 'addRepo',
    mirrorRepourl: 'https://mirrors.cloud.tencent.com/postgresql/repos/apt/',
    repourl: 'http://apt.postgresql.org/pub/repos/apt',
    dpgkFile: 'pgdg.list',
    mirrorKeyUrl: 'https://mirrors.cloud.tencent.com/postgresql/repos/apt/ACCC4CF8.asc',
    keyUrl: 'https://www.postgresql.org/media/keys/ACCC4CF8.asc'
  }
}
// 为指定节点，安装software规定的软件。
async function ensurePkg (node, pkgName, pkgVer) {
  const info = await pkgInfo(node, pkgName)
  let install = true
  // console.log(pkgName, 'info=', info)
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
    const { s } = node.$env.soa
    const bMirror = node.$env.args.mirror
    const pdetail = pkgDetails[pkgName]
    const commonName = s.startsWith(pkgName, '$') ? s.strRight(pkgName, '$') : pkgName
    const sysctlName = getSrvname(commonName)

    const installMode = (pdetail ? pdetail.mode : 'std') || 'std'
    if (installMode === 'addRepo') {
    // 不拦截错误，发生错误抛出异常。如未获取到pkgdetail，也会触发错误。
      await term.exec(`sudo sh -c 'echo "deb ${bMirror ? pdetail.mirrorRepourl : pdetail.repourl} $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/${pdetail.dpgkFile}'`)
      await term.pvexec(`sudo wget --quiet -O - ${bMirror ? pdetail.mirrorKeyUrl : pdetail.keyUrl} | sudo apt-key add -`)
      await term.exec(`sudo apt-get -y install apt-transport-https 2>&1 | tee -a ${node.logfname}`)
      await term.exec(`sudo apt-get -y update 2>&1 | tee -a ${node.logfname}`)
      await term.exec(`sudo apt-get -y install ${sysctlName} 2>&1 | tee -a ${node.logfname}`)
      if (pkgName === 'postgres') { // 为postgresql额外配置，无条件开放端口，交由防火墙防护。
        let pathFile = await term.exec('ls /etc/postgresql/15/main/postgresql.conf').catch(e => '')
        if (!pathFile) {
          pathFile = await term.exec('ls /etc/postgresql/14/main/postgresql.conf').catch(e => '')
        }
        if (!pathFile) {
          throw new Error('无法定位postgres的配置文件')
        }
        await term.exec(`sudo echo "listen_addresses = '*'" >> ${pathFile}`)
      }
      await term.exec(`sudo systemctl start ${sysctlName}`)
      console.log(node.$name, 'install ', pkgName, 'finished!')
    } else if (installMode === 'std') {
      // 标准安装模式。
      console.log('install std pkg,', pkgName)
      await term.exec(`sudo apt-get -y install ${sysctlName} 2>&1 | tee -a ${node.logfname}`)
      await term.exec('sudo sed -i \'s#bind 127.0.0.1#bind 0.0.0.0#g\' /etc/redis/redis.conf').catch(e => false)
      await term.exec(`sudo systemctl start ${sysctlName} 2>&1 | tee -a ${node.logfname}`)
    } else {
      throw new Error('debian下未支持的包安装模式:', pkgName, installMode)
    }
  }
  // console.log(`${pkgName} info=`, info)
}

async function port (node, method, number) {
// 首先确保ufw安装完毕。
  const term = node.$term
  const hasUfw = await term.exec('which ufw').catch(e => '')
  if (!hasUfw) {
    await term.exec(`sudo apt-get -y install ufw 2>&1 | tee -a ${node.logfname}`)
    await term.exec('sudo ufw allow OpenSSH')
    await term.exec('sudo ufw default allow outgoing')
    await term.exec('sudo ufw default deny incoming')
    await term.pvexec('sudo ufw enable\ny', {
      out: [{
        method: 'wait',
        exp: 'Proceed with operation (y|n)',
        action: (socket) => {
          console.log('found proceed with operation!!')
          return socket.stdin.write('exit\n')
        }
      }]
    })
  }
  const cmdStr = (method === 'open') ? 'allow' : 'deny'
  const { _ } = node.$env.soa
  if (_.isArray(number)) {
    for (const num of number) {
      await term.exec(`sudo ufw ${cmdStr} ${num}`)
    }
  } else {
    await term.exec(`sudo ufw ${cmdStr} ${number}`)
  }
  await term.exec('sudo ufw reload')
}
module.exports.pkgInfo = pkgInfo
module.exports.ensurePkg = ensurePkg
module.exports.port = port
module.exports.startSrv = startSrv
