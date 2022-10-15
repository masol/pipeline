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

const Local = require('./local')
const SSH = require('./ssh')

function create (name, nodeDef, cluster) {
  if (nodeDef.type === 'local') {
    return new Local(name, nodeDef, cluster)
  }
  return new SSH(name, nodeDef, cluster)
}

module.exports.create = create
