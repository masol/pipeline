/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 24 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: webapi

const fse = require('fs-extra')
const path = require('path')
const uglifyjs = require('uglify-js')
const composer = require('gulp-uglify/composer')

async function compile (cluster, cfg) {
  // console.log('this.envs.gulpInst=', cluster.envs.gulpInst)
  const destPath = path.join(cluster.cacheBase, 'target', 'webapi')
  await fse.emptyDir(destPath)
  const { src, dest } = cluster.envs.gulpInst
  // 拷贝辅助文件。
  const cpTask = new Promise((resolve, reject) => {
    src(['package.json', 'LICENSE', `config/${cluster.envs.args.target}/**/*`], { base: './' })
      .pipe(dest(destPath))
      .on('error', reject)
      .on('end', resolve)
  })

  // const localDate = cluster.envs.soa.moment(rlm(['src', 'start.js', 'app.js']))
  await fse.outputFile(path.join(destPath, 'version.txt'), cluster.envs.soa.moment().format())

  await cpTask
  const minify = composer(uglifyjs, console)
  return new Promise((resolve, reject) => {
    src(['*.js', 'src/*.js', 'src/**/*.js'], { base: './' })
      .pipe(minify())
      .on('error', reject)
      .pipe(dest(destPath))
      .on('end', resolve)
  })
}

module.exports = compile
