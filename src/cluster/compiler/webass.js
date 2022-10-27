/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 25 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: webass

const fse = require('fs-extra')
const path = require('path')

async function compile (cluster, cfg) {
  // 获取ui子项目目录。
  const { shelljs } = cluster.envs.soa
  const pwd = String(shelljs.pwd())
  const uiPrjPath = cluster.project.$webass || path.join(path.dirname(pwd), path.basename(pwd) + 'ui')
  if (!(await fse.pathExists(uiPrjPath))) {
    throw new Error(`编译$webass时，子项目${uiPrjPath}不存在！`)
  }
  // console.log('uiPrjPath=', uiPrjPath)
  await shelljs.cd(uiPrjPath)
  await shelljs.exec('npm run build')
  await shelljs.cd(pwd)
  // await fse.emptyDir(destPath)
}

module.exports = compile
