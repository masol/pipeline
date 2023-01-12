/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Jan 2023 By 李竺唐 of 北京飞鹿软件技术研究院
// File: pipe

module.exports = function (opts) {
  return async function () {
    const { cluster } = opts
    return await cluster.pipe()
  }
}
