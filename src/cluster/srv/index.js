/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const Base = require('./base')

function create (name, srvDef, node) {
  return new Base(name, srvDef, node)
}

// 将指定srvDef分配到cluster中。
function alloc (cluster, name, srvDef) {

}

module.exports.create = create
module.exports.alloc = alloc
