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

/// 将内部服务映射为issue指定的服务名称。
const srvNameMap = {
  postgres: 'postgresql'
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
  const usedName = srvnameFunc(commonName)

  let status
  const statusRes = await term.exec(`systemctl status ${usedName}`).catch(e => {
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
    ret.ok = true
  }
  // console.log('ret=', ret)
  return ret
}

// 本issue下关于pkg维护的信息。默认采用腾讯云镜像，可自行换用清华，阿里等镜像。
const pkgDetails = {
  postgres: {
    repo: true,
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
    await term.exec(`sudo sh -c 'echo "deb ${bMirror ? pdetail.mirrorRepourl : pdetail.repourl} $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/${pdetail.dpgkFile}'`)
    await term.pvexec(`sudo wget --quiet -O - ${bMirror ? pdetail.mirrorKeyUrl : pdetail.keyUrl} | sudo apt-key add -`)
    await term.exec(`sudo apt-get -y install apt-transport-https 2>&1 | tee -a ${node.logfname}`)
    await term.exec(`sudo apt-get -y update 2>&1 | tee -a ${node.logfname}`)
    await term.exec(`sudo apt-get -y install postgresql 2>&1 | tee -a ${node.logfname}`)
    await term.exec('sudo systemctl start postgresql')
    console.log(node.$name, 'install ', pkgName, 'finished!')
  }
  // console.log(`${pkgName} info=`, info)
}
module.exports.pkgInfo = pkgInfo
module.exports.ensurePkg = ensurePkg
