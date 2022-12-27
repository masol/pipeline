/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 27 Dec 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: base

class Base {
  constructor (def, cluster) {
    this.$def = def
    this.$cluster = cluster
  }

  purgePath (pathes) {
    throw new Error('purgePath not implement!')
  }

  chdDomains (domains) {
    throw new Error('chdDomains not implement!')
  }
}

module.exports = Base
