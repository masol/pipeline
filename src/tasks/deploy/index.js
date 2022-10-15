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
    let hassh = false

    for (const name in deployer.nodes) {
      const node = deployer.nodes[name]
      if (node.type === 'ssh') {
        hassh = true
      }
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
    let animation
    if (hassh) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在通过SSH部署(日志保存在每节点的~/install-日期.log中)。'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }
    await Promise.all(tasks)
    if (animation) {
      animation.replace('正在编译本地资源,请稍侯...')
    }
    if (needComp.$webass) {
      // run local assets compile task
    }
    if (needComp.$webapi) {
      // run local server compile task
    }
    tasks.length = 0
    for (const idx in compNodes) {
      // 有依赖本地编译的额外部署。
      const item = compNodes[idx]
      tasks.push(deployer.driver.deployComp(item.node, item.name))
    }
    if (animation) {
      animation.replace('正在部署$web相关服务,请稍侯...')
    }
    await Promise.all(tasks)
    if (animation) {
      animation.replace('通过SSH部署完成.')
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          animation.stop()
          resolve()
        }, 500)
      })
    }
  }
}
