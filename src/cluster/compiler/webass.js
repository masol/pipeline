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
  const uiPrjPath = cluster.$uiPrjPath
  if (!(await fse.pathExists(uiPrjPath))) {
    throw new Error(`编译$webass时，子项目${uiPrjPath}不存在！`)
  }
  // console.log('uiPrjPath=', uiPrjPath)
  await shelljs.cd(uiPrjPath)
  shelljs.env.API_ENDPOINT = cluster.apiEndpoint()
  const result = await shelljs.exec('npm run build')
  if (!result || result.code !== 0) {
    throw new Error('UI子项目编译错误，无法继续，请查看错误信息并修正．')
  }
  await shelljs.cd(pwd)
  await fse.outputFile(path.join(uiPrjPath, 'build', 'version.txt'), cluster.envs.soa.moment().format())

  // await fse.emptyDir(destPath)
}

module.exports = compile
