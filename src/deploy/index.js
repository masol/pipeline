/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const Names = {
  $webass: 'WebUI编译',
  $webapi: '服务器编译',
  $webmb: '手机版编译',
  $webwx: '小程序编译',
  $webapp: '应用程序编译',
  $webtv: 'TV应用编译'
}

module.exports = function (opts) {
  return async function () {
    const { deployer } = opts
    const { _ } = opts.soa
    // 首先查找是否需要本地编译webapi或webass.
    const needComp = {}
    // const { task, series } = opts.gulpInst

    const compSrvs = _.keys(Names)
    const compNodes = []
    const tasks = []
    for (const name in deployer.nodes) {
      const node = deployer.nodes[name]
      let addToCompNode = false
      for (const srvName in node.srvs) {
        if (compSrvs.indexOf(srvName) >= 0) {
          needComp[srvName] = true
          addToCompNode = true
        }
      }
      if (addToCompNode) {
        compNodes.push({
          name,
          node
        })
      }
      tasks.push(deployer.driver.deployBase(node, name))
    }
    await Promise.all(tasks)
    if (needComp.$webass) {
      // run assets compile task
    }
    if (needComp.$webapi) {
      // run server compile task
    }
    tasks.length = 0
    for (const idx in compNodes) {
      // 有依赖本地编译的额外部署。
      const item = compNodes[idx]
      tasks.push(deployer.driver.deployComp(item.node, item.name))
    }
    await Promise.all(tasks)
  }
}
