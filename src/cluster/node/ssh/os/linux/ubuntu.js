/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 13 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: ubuntu

const debian = require('./debian')

// ubuntu镜像使用清华大学镜像。https://mirror.tuna.tsinghua.edu.cn/help/ubuntu/
module.exports.mirror = async function ({ node, term, logfname, s }) {
  const isMirror = s.trim(await term.exec('grep "mirrors.tuna.tsinghua.edu.cn" /etc/apt/sources.list').catch(e => false))
  if (!isMirror) {
    await term.exec('sudo sed -i "s@http://.*archive.ubuntu.com@https://mirrors.tuna.tsinghua.edu.cn@g" /etc/apt/sources.list').catch(e => false)
    await term.exec('sudo sed -i "s@http://.*security.ubuntu.com@https://mirrors.tuna.tsinghua.edu.cn@g" /etc/apt/sources.list').catch(e => false)
    await term.exec(`sudo apt-get update 2>&1 | tee -a ${logfname}`).catch(e => false)
    await term.exec(`sudo apt-get upgrade 2>&1 | tee -a ${logfname}`).catch(e => false)
  }
}

module.exports.status = debian.status
