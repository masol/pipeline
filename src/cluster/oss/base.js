/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 25 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: base

const fse = require('fs-extra')
const path = require('path')

class Base {
  constructor (def, cluster) {
    this.$def = def
    this.$cluster = cluster
  }

  async gatherFiles (localDir, pathes) {
    const that = this
    // 返回true表示继续。filter只处理文件，目录会全部保存。
    const dirs = await fse.readdir(localDir).catch(e => {
      if (e.code === 'ENOENT') { // 忽略不存在的错误。
        return []
      }
      throw e
    })
    // console.log('cp2 local dirs=', dirs)
    for (const item of dirs) {
      // console.log('item=', item)
      // 不使用lstat,忽略link.
      const fullItem = path.join(localDir, item)
      const stats = await fse.stat(fullItem)
      // console.log('stats=', stats)
      if (stats.isDirectory()) {
        await that.gatherFiles(fullItem, pathes)
      } else if (stats.isFile()) {
        // 加入文件拷贝任务。
        pathes.push(fullItem)
      } else if (stats.isSymbolicLink()) {
        console.log('忽略符号链接拷贝请求:', fullItem)
      } else {
        throw new Error(`本地文件${fullItem}不被支持!`)
      }
    }
  }
}

module.exports = Base
