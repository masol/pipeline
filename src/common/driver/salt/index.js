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

const Local = require('../local')

class Salt extends Local {
  async srvStatus (node) {
    if (node.type === 'ssh') {
      throw new Error('sal srvStatus 尚未实现')
    } else {
      return super.srvStatus(node)
    }
  }

  async info (node) {
    if (!node.$info) {
      if (node === 'ssh') {
        console.log('enter ssh node info!!')
      } else {
        await super.info(node)
      }
    }
  }
}

module.exports = Salt
