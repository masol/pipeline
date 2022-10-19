/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 16 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: utils
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

// 将以冒号分割的输出(类似dpkg)解析为json对象。
function colonSep (s, str, opts = {}) {
  const lines = s.lines(str)
  const ret = {
    unassigned: []
  }
  const append = (str1, str2) => {
    return s.trim(str1) + s.trim(str2)
  }
  let lastKey = ''
  for (const line of lines) {
    const key = s.trim(s.strLeft(line, ':'))
    const value = s.trim(s.strRight(line, ':'))
    if (opts.blankAppend && lastKey && line && line[0] === ' ') {
      ret[lastKey] = append(ret[lastKey], s.trim(line))
    }
    if (value) {
      ret[key] = s.trim(value)
      lastKey = key
    } else {
      if (!lastKey) {
        ret.unassigned.push(s.trim(value))
      } else {
        ret[lastKey] = append(ret[lastKey], value)
      }
      ret[lastKey || 'unassigned'] = append(ret[lastKey || 'unassigned'], value)
    }
  }
  return ret
}

module.exports = {
  getByte,
  colonSep
}
