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

module.exports.status = debian.status
module.exports.deploy = debian.deploy

/// ////////////////////////////////////////////////////////////////
// 节点维护函数。
/// ////////////////////////////////////////////////////////////////

async function ensurePkg (node, pkgName, pkgVer) {
}
async function pkgInfo (node, pkgName) {
}
module.exports.pkgInfo = pkgInfo
module.exports.ensurePkg = ensurePkg
