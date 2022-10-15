/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 10 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: utils

function getDockerBin (shelljs) {
  const dockerPath = shelljs.which('docker')
  if (!dockerPath || dockerPath.code !== 0) {
    throw new Error('无法获取Docker程序路径，因此无法获取本地环境的服务状态。需要安装Docker。')
  }
  return dockerPath.stdout
}

module.exports = {
  getDockerBin
}
