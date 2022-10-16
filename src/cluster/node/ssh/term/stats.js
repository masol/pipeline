/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 14 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: stats

// @TODO: 无法通过SSH2Promise的sftp获取ssh2的Stats对象。自行实现一个目录检查。
const constants = require('fs').constants

class Stats {
  constructor (initial) {
    this.mode = (initial && initial.mode)
    this.permissions = this.mode // backwards compatiblity
    this.uid = (initial && initial.uid)
    this.gid = (initial && initial.gid)
    this.size = (initial && initial.size)
    this.atime = (initial && initial.atime)
    this.mtime = (initial && initial.mtime)
  }

  _checkModeProperty (property) {
    return ((this.mode & constants.S_IFMT) === property)
  }

  isDirectory () {
    return this._checkModeProperty(constants.S_IFDIR)
  }

  isFile () {
    return this._checkModeProperty(constants.S_IFREG)
  }

  isBlockDevice () {
    return this._checkModeProperty(constants.S_IFBLK)
  }

  isCharacterDevice () {
    return this._checkModeProperty(constants.S_IFCHR)
  }

  isSymbolicLink () {
    return this._checkModeProperty(constants.S_IFLNK)
  }

  isFIFO () {
    return this._checkModeProperty(constants.S_IFIFO)
  }

  isSocket () {
    return this._checkModeProperty(constants.S_IFSOCK)
  }
}

module.exports = Stats
