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
  async finish (node) {
    if (node.$term) {
      const term = node.$term
      delete node.$term
      await term.close()
    }
  }

  async deployBase (node, name) {
    if (node.type !== 'ssh') {
      return await super.deployBase(node, name)
    }
    node.$term = node.$term || await Term.create(this.opts, node)
    await require(`./os/${node.$info.os.type.toLowerCase()}`).deployBase(this, { name, node, term: node.$term })
  }

  async deployComp (node, name) {
    if (node.type !== 'ssh') {
      return await super.deployComp(node, name)
    }
  }

  async srvStatus (node) {
    if (node.type !== 'ssh') {
      return await super.srvStatus(node)
    }
    const term = node.$term || await Term.create(this.opts, node)
    node.$term = term
    for (const srvName in node.srvs) {
      const srv = node.srvs[srvName]
      if (!srv.status) {
        srv.status = {}
        await require(`./os/${node.$info.os.type.toLowerCase()}`).srv(this, { srvName, srv, node, term })
      }
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
      const term = node.$term || await Term.create(this.opts, node)
      node.$term = term

      // console.log('term=', term)
      // const shell = await term.shell()
      $info.os = {}
      $info.os.type = s.trim(await term.exec('uname -s'))
      // console.log(fetcherImpl)
      // 如果对应type的fetcher不存在，直接抛出异常。
      await require(`./os/${$info.os.type.toLowerCase()}`).info(this, { node, term, s, getByte })
      // await term.close()
    }
  }
}

module.exports = Salt
