/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of SanPolo.Co.LTD
// File: salt

const DriverBase = require('./base')

class Salt extends DriverBase {
  async srvStatus (node) {
    if (node.type === 'local') {
      return super.srvStatus(node)
    } else if (node.type === 'oss') {
      // 忽略
    } else {
      throw new Error('尚未实现')
    }
  }
}

module.exports = Salt
