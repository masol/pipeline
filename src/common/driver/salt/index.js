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
const Term = require('./term')

/** 获取linux cat /proc/meminfo某行的值。结果为bytes. */

function getByte (s, line) {
  const mem = (s.trim(s.strRight(line, ':'))).split(' ')
  let mul = 1
  if (mem.length > 1) {
    switch ((s.trim(mem[1])).toLowerCase()) {
      case 'kb':
        mul = 1024
        break
      case 'mb':
        mul = 1024 * 1024
        break
      case 'gb':
        mul = 1024 * 1024
    }
  }
  const num = parseInt(mem[0]) * mul
  return num
}

class Salt extends Local {
  async srvStatus (node) {
    if (node.type !== 'ssh') {
      return await super.srvStatus(node)
    }
    // throw new Error('sal srvStatus 尚未实现')
  }

  async info (node) {
    if (node.type !== 'ssh') {
      return await super.info(node)
    }
    if (!node.$info) {
      const { s } = this.opts.soa
      node.$info = {}
      const $info = node.$info
      const term = await Term.create(this.opts, node)
      // console.log('term=', term)
      // const shell = await term.shell()
      $info.os = {}
      $info.os.type = s.trim(await term.exec('uname -s'))
      // console.log(fetcherImpl)
      // 如果对应type的fetcher不存在，直接抛出异常。
      await require(`./info/${$info.os.type.toLowerCase()}`).info(this, { node, term, s, getByte })
      await term.close()
    }
  }
}

module.exports = Salt
