/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 14 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: postgres

const srvUtil = require('./utils')

module.exports.deploy = async (node, { localBase, stateTop, pillarTop, srvName, srv, postTasks }) => {
  const info = {
    name: srvName,
    ver: 'v0.45.0',
    url: 'https://github.com/saltstack-formulas/postgres-formula/archive/refs/tags/',
    mirror: 'https://libs.wware.org/stacksalt/formula/postgres/',
    idFile: 'FORMULA', // 确定formula根目录的文件。
    subDir: 'postgres', // 在formula zip根目录确定后，真正State的子目录，如果是空，则根目录即为State定义目录。
    localBase
  }

  await srvUtil.ensureStateRes(node, info)

  srvUtil.addSrv(stateTop, srvName)
  srvUtil.addSrv(pillarTop, srvName)
}
