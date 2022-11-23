/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 23 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: oss

class OSS {
  #def
  #inst
  constructor (def) {
    this.#def = def
    if (def.type && def.type !== 'aws') {
      // 基类只处理AWS兼容的oss,其它会设置#inst并派遣方法。
      throw new Error('尚未支持非AWS兼容的OSS.')
    } else {
      def.AWS.config.update(this.#def.conf)
      this.#inst = new def.AWS.S3({})
      console.log('this.#inst=', this.#inst)
    }
  }
}

module.exports = OSS
