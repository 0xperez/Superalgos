/*

The chart space is where all the charts live. What this space contains is a type of object we call Time Machine. A Time Machine is a cointainer of
charts objects. The idea is simple, all the chart objects are ploted according to the time of the Time Machine object. When the time of the Time Machine
changes, then all charts in it are replotted with the corresponging data.

*/

function newChartSpace () {
  const MODULE_NAME = 'Chart Space'
  const ERROR_LOG = true
  const logger = newWebDebugLog()
  logger.fileName = MODULE_NAME

  let thisObject = {
    visible: true,
    container: undefined,
    timeMachines: [],
    oneScreenUp: oneScreenUp,
    oneScreenDown: oneScreenDown,
    oneScreenLeft: oneScreenLeft,
    oneScreenRight: oneScreenRight,
    fitIntoVisibleArea: fitIntoVisibleArea,
    isThisPointVisible: isThisPointVisible,
    physics: physics,
    draw: draw,
    getContainer: getContainer,     // returns the inner most container that holds the point received by parameter.
    initialize: initialize,
    finalize: finalize
  }

  let canvasBrowserResizedEventSubscriptionId
  let timeMachinesMap = new Map()
  let syncWithDesignerLoop = 0

  const PERCENTAGE_OF_SCREEN_FOR_DISPLACEMENT = 25

  setupContainer()
  return thisObject

  function setupContainer () {
    thisObject.container = newContainer()
    thisObject.container.initialize(MODULE_NAME)

    thisObject.container.isDraggeable = false
    thisObject.container.isWheelable = false
  }

  function finalize () {
    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      let timeMachine = thisObject.timeMachines[i]
      timeMachine.finalize()
    }

    thisObject.timeMachines = undefined
    timeMachinesMap = undefined

    thisObject.container.eventHandler.stopListening(canvasBrowserResizedEventSubscriptionId)

    thisObject.container.finalize()
    thisObject.container = undefined
  }

  function initialize () {
    canvasBrowserResizedEventSubscriptionId = window.canvasApp.eventHandler.listenToEvent('Browser Resized', resize)
  }

  function getContainer (point, purpose) {
    if (thisObject.visible !== true) { return }

    let container

       /* Now we see which is the inner most container that has it */

    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      container = thisObject.timeMachines[i].getContainer(point, purpose)
      if (container !== undefined) {
        if (purpose !== undefined) {
          if (container.isForThisPurpose(purpose)) {
            if (thisObject.container.frame.isThisPointHere(point, true) === true) {
              return container
            }
          }
        } else {
          if (thisObject.container.frame.isThisPointHere(point, true) === true) {
            return container
          }
        }
      }
    }

    if (thisObject.container.frame.isThisPointHere(point, true) === true) {
      return thisObject.container
    } else {
      return undefined
    }
  }

  function resize () {
    thisObject.container.frame.width = browserCanvas.width
    thisObject.container.frame.height = COCKPIT_SPACE_POSITION
  }

  function oneScreenUp () {
    let displaceVector = {
      x: 0,
      y: +browserCanvas.height * PERCENTAGE_OF_SCREEN_FOR_DISPLACEMENT / 100
    }

    viewPort.displace(displaceVector)
  }

  function oneScreenDown () {
    let displaceVector = {
      x: 0,
      y: -browserCanvas.height * PERCENTAGE_OF_SCREEN_FOR_DISPLACEMENT / 100
    }

    viewPort.displace(displaceVector)
  }

  function oneScreenLeft () {
    let displaceVector = {
      x: browserCanvas.width * PERCENTAGE_OF_SCREEN_FOR_DISPLACEMENT / 100,
      y: 0
    }

    viewPort.displace(displaceVector, true)
  }

  function oneScreenRight () {
    let displaceVector = {
      x: -browserCanvas.width * PERCENTAGE_OF_SCREEN_FOR_DISPLACEMENT / 100,
      y: 0
    }

    viewPort.displace(displaceVector, true)
  }

  function fitIntoVisibleArea (point, fullVisible) {
       /* Here we check the boundaries of the resulting points, so they dont go out of the visible area. */

    let returnPoint = {
      x: point.x,
      y: point.y
    }

    if (point.x > browserCanvas.width) {
      returnPoint.x = browserCanvas.width
    }

    if (point.x < 0) {
      returnPoint.x = 0
    }

    if (fullVisible === true) {
      if (point.y > COCKPIT_SPACE_POSITION) {
        returnPoint.y = COCKPIT_SPACE_POSITION
      }
    } else {
      if (point.y > COCKPIT_SPACE_POSITION + COCKPIT_SPACE_HEIGHT / 2) {
        returnPoint.y = COCKPIT_SPACE_POSITION + COCKPIT_SPACE_HEIGHT / 2
      }
    }

    if (point.y < 0) {
      returnPoint.y = 0
    }

    return returnPoint
  }

  function isThisPointVisible (point) {
    if (point.x > browserCanvas.width) {
      return false
    }

    if (point.x < 0) {
      return false
    }

    if (point.y > COCKPIT_SPACE_POSITION + COCKPIT_SPACE_HEIGHT / 2) {
      return false
    }

    if (point.y < 0) {
      return false
    }

    return true
  }

  function physics () {
    thisObjectPhysics()
    childrenPhysics()
    syncWithDesigner()
  }

  function syncWithDesigner () {
    syncWithDesignerLoop = syncWithDesignerLoop + 0.00000000001

    let rootNodes = canvas.designerSpace.workspace.workspaceNode.rootNodes
    for (let i = 0; i < rootNodes.length; i++) {
      let rootNode = rootNodes[i]
      if (rootNode.type === 'Charting System') {
        let chartingSystem = rootNode
        if (chartingSystem.timeMachines !== undefined) {
          for (let j = 0; j < chartingSystem.timeMachines.length; j++) {
            let node = chartingSystem.timeMachines[j]
            let timeMachine = timeMachinesMap.get(node.id)
            if (timeMachine === undefined) {
              /* The time machine node is new, thus we need to initialize a new timeMachine */
              initializeTimeMachine(node, syncWithDesignerLoop)
            } else {
              /* The time machine already exists, we tag it as existing at the current loop. */
              timeMachine.syncWithDesignerLoop = syncWithDesignerLoop
            }
          }
        }
      }
    }
    /* We check all the timeMachines we have to see if we need to remove any of them */
    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      let timeMachine = thisObject.timeMachines[i]
      if (timeMachine.syncWithDesignerLoop < syncWithDesignerLoop) {
        /* Must be removed */
        timeMachine.finalize()
        timeMachinesMap.delete(timeMachine.nodeId)
        thisObject.timeMachines.splice(i, 1)
        /* We remove one at the time */
        return
      }
    }

    function initializeTimeMachine (node, syncWithDesignerLoop) {
      let timeMachine = newTimeMachine()
      timeMachine.syncWithDesignerLoop = syncWithDesignerLoop
      timeMachine.payload = node.payload
      timeMachine.nodeId = node.id
      timeMachinesMap.set(node.id, timeMachine)
      timeMachine.payload.uiObject.setValue('Loading...')

      /* Setting up the new time machine. */
      timeMachine.container.frame.position.x = thisObject.container.frame.width / 2 - timeMachine.container.frame.width / 2
      timeMachine.container.frame.position.y = thisObject.container.frame.height / 2 - timeMachine.container.frame.height / 2
      timeMachine.container.fitFunction = fitIntoVisibleArea
      timeMachine.fitFunction = fitIntoVisibleArea
      timeMachine.initialize(onTimeMachineInitialized)

      function onTimeMachineInitialized (err) {
        if (err.result !== GLOBAL.DEFAULT_OK_RESPONSE.result) {
          if (ERROR_LOG === true) { logger.write('[ERROR] syncWithDesigner -> initializeTimeMachine -> Initialization Failed. -> Err ' + err.message) }
          return
        }

        thisObject.timeMachines.push(timeMachine)
        timeMachine.payload.uiObject.setValue('')
        viewPort.raiseEvents() // These events will impacts on objects just initialized.
      }
    }
  }

  function thisObjectPhysics () {
    thisObject.container.frame.height = COCKPIT_SPACE_POSITION

    if (thisObject.container.frame.height <= 0 / 100) {
      thisObject.visible = false
    } else {
      thisObject.visible = true
    }

    viewPort.resize()
  }

  function childrenPhysics () {
    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      let timeMachine = thisObject.timeMachines[i]
      timeMachine.physics()
    }
  }

  function draw () {
    if (thisObject.visible !== true) { return }
    drawBackground()

    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      let timeMachine = thisObject.timeMachines[thisObject.timeMachines.length - i - 1]
      timeMachine.draw()
    }
  }

  function drawBackground () {
    drawSpaceBackground()

    for (let i = 0; i < thisObject.timeMachines.length; i++) {
      let timeMachine = thisObject.timeMachines[thisObject.timeMachines.length - i - 1]
      timeMachine.drawBackground()
    }
  }
  function drawSpaceBackground () {
    let opacity = '1'
    let fromPoint = {
      x: 0,
      y: 0
    }

    let toPoint = {
      x: browserCanvas.width,
      y: COCKPIT_SPACE_POSITION
    }

    browserCanvasContext.beginPath()
    browserCanvasContext.rect(fromPoint.x, fromPoint.y, toPoint.x - fromPoint.x, toPoint.y - fromPoint.y)
    browserCanvasContext.fillStyle = 'rgba(' + UI_COLOR.WHITE + ', ' + opacity + ')'
    browserCanvasContext.closePath()
    browserCanvasContext.fill()
  }
}
