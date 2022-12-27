/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 27 Dec 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

function Create (def, cluster) {
  const type = def.type || 'tencent'
  let inst
  try {
    // console.log('type=', type)
    const Cls = require(`./${type}`)
    // console.log('Cls=', Cls)
    inst = new Cls(def, cluster)
  } catch (e) {
    console.log(e)
    throw new Error(`未支持的CDN，类型为${type}`)
  }
  return inst
}

module.exports = Create
