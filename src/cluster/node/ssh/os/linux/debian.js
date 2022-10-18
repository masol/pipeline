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

// debian镜像使用腾讯云,支持http协议，无需执行 apt-get install apt-transport-https
module.exports.mirror = async function (driver, { node, term, logfname, s }) {
  const isMirror = s.trim(await term.exec('grep "mirrors.cloud.tencent.com" /etc/apt/sources.list').catch(e => false))
  if (!isMirror) {
    await term.exec('sudo sed -i \'s#http://deb.debian.org#http://mirrors.cloud.tencent.com#g\' /etc/apt/sources.list').catch(e => false)
    await term.exec(`sudo apt-get update 2>&1 | tee -a ${logfname}`).catch(e => false)
    await term.exec(`sudo apt-get upgrade 2>&1 | tee -a ${logfname}`).catch(e => false)
  }
}

const srvNameMap = {
  postgres: 'postgresql'
}

module.exports.status = async function (srv) {
  const { s, _ } = srv.node.$env.soa
  const srvName = srv.name
  const term = srv.node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  const usedName = srvNameMap[commonName] || commonName

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

// 为指定节点，安装software规定的软件。
module.exports.install = async function (node, software) {
}
