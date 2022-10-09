
module.exports = function (opts) {
  return async function () {
    const { deployer } = opts
    // console.log('deployer=', deployer)
    for (const name in deployer.nodes) {
      await deployer.driver.info(deployer.nodes[name])
    }
    for (const name in deployer.services) {
      await deployer.driver.allocSrv(deployer.nodes, name, deployer.services[name])
    }

    const tasks = []
    for (const name in deployer.nodes) {
      tasks.push(
        deployer.driver.srvStatus(deployer.nodes[name])
      )
    }
    await Promise.all(tasks)
    // console.log('deployer.nodes=', deployer.nodes.local)
  }
}
