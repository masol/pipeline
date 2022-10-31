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
module.exports.mirror = async function (node) {
  const stageName = 'mirror'
  if (!node.hasStage(stageName)) {
    const cmd = `mirror=$(sudo grep "mirrors.tuna.tsinghua.edu.cn" /etc/apt/sources.list)
if test -z "$mirror"
then
  sudo sed -i "s@http://.*archive.ubuntu.com@https://mirrors.tuna.tsinghua.edu.cn@g" /etc/apt/sources.list
  sudo sed -i "s@http://.*security.ubuntu.com@https://mirrors.tuna.tsinghua.edu.cn@g" /etc/apt/sources.list
  sudo apt-get -y update
  sudo apt-get -y upgrade
else
  echo "\\$mirror already setting"
fi
  `
    node.addStage(stageName, cmd)
  }
}

module.exports.status = debian.status
module.exports.port = debian.port
module.exports.ensurePkg = debian.ensurePkg
module.exports.startSrv = debian.startSrv
