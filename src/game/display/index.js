import './game-display.scss'

import $ from 'jquery'

import PlayerDisplay from './player-display'
import formatTime from '../../utils/formatTime'
import { shouldDisableFullScreen } from 'bemuse/devtools/query-flags'

export class GameDisplay {
  constructor ({ game, context, backgroundImagePromise, video }) {
    this._game = game
    this._context = context
    const skinData = context.skinData
    this._players = new Map(
      game.players.map(player => [player, new PlayerDisplay(player, skinData)])
    )
    this._stateful = {}
    this._wrapper = this._createWrapper({
      backgroundImagePromise,
      video,
      panelPlacement: game.players[0].options.placement,
      infoPanelPosition: skinData.infoPanelPosition
    })
    this._createTouchEscapeButton({
      displayByDefault: skinData.mainInputDevice === 'touch'
    })
    this._createFullScreenButton()
  }
  setEscapeHandler (escapeHandler) {
    this._onEscape = escapeHandler
  }
  setReplayHandler (replayHandler) {
    this._onReplay = replayHandler
  }
  start () {
    this._started = new Date().getTime()
    let player = this._game.players[0]
    let songInfo = player.notechart.songInfo
    this._stateful['song_title'] = songInfo.title
    this._stateful['song_artist'] = songInfo.artist
    this._duration = player.notechart.duration
  }
  destroy () {
    this._context.destroy()
  }
  update (gameTime, gameState) {
    let time = (new Date().getTime() - this._started) / 1000
    let data = this._getData(time, gameTime, gameState)
    this._updateStatefulData(time, gameTime, gameState)
    this._context.render(Object.assign({}, this._stateful, data))
    if (this._video && !this._videoStarted && gameTime >= this._videoOffset) {
      this._video.volume = 0
      this._video.play()
      this._video.classList.add('is-playing')
      this._videoStarted = true
    }
  }
  _getData (time, gameTime, gameState) {
    let data = {}
    data['tutorial'] = this._game.options.tutorial ? 'yes' : 'no'
    data['t'] = time
    data['gameTime'] = gameTime
    data['ready'] = this._getReady(gameState)
    data['song_time'] = this._getSongTime(gameTime)
    for (let [player, playerDisplay] of this._players) {
      let playerState = gameState.player(player)
      let playerData = playerDisplay.update(time, gameTime, playerState)
      for (let key in playerData) {
        data[`p${player.number}_${key}`] = playerData[key]
      }
    }
    return data
  }
  _updateStatefulData (time, gameTime, gameState) {
    let data = this._stateful
    if (data['started'] === undefined && gameState.started) {
      data['started'] = time
    }
    if (data['gettingStarted'] === undefined && gameState.gettingStarted) {
      data['gettingStarted'] = time
    }
  }
  _getSongTime (gameTime) {
    return (
      formatTime(Math.min(this._duration, Math.max(0, gameTime))) +
      ' / ' +
      formatTime(this._duration)
    )
  }
  _getReady (gameState) {
    let f = gameState.readyFraction
    return f > 0.5 ? Math.pow(1 - (f - 0.5) / 0.5, 2) : 0
  }
  _createWrapper ({
    backgroundImagePromise,
    video,
    panelPlacement,
    infoPanelPosition
  }) {
    var $wrapper = $('<div class="game-display"></div>')
      .attr('data-panel-placement', panelPlacement)
      .attr('data-info-panel-position', infoPanelPosition)
      .append('<div class="game-display--bg js-back-image"></div>')
      .append(this.view)
    if (backgroundImagePromise) {
      Promise.resolve(backgroundImagePromise).then(image =>
        $wrapper.find('.js-back-image').append(image)
      )
    }
    if (video) {
      this._video = video.element
      this._videoOffset = video.offset
      $(video.element)
        .addClass('game-display--video-bg')
        .appendTo($wrapper)
    }
    return $wrapper[0]
  }
  _createTouchEscapeButton ({ displayByDefault }) {
    const touchButtons = document.createElement('div')
    touchButtons.className = 'game-display--touch-buttons is-left'
    this.wrapper.appendChild(touchButtons)
    if (displayByDefault) {
      touchButtons.classList.add('is-visible')
    } else {
      let shown = false
      this.wrapper.addEventListener(
        'touchstart',
        () => {
          if (shown) return
          shown = true
          touchButtons.classList.add('is-visible')
        },
        true
      )
    }
    const addTouchButton = (className, onClick) => {
      let button = createTouchButton(onClick, className)
      touchButtons.appendChild(button)
    }
    addTouchButton('game-display--touch-escape-button', () => this._onEscape())
    addTouchButton('game-display--touch-replay-button', () => this._onReplay())
  }

  _createFullScreenButton () {
    if (
      shouldDisableFullScreen() ||
      !document.documentElement.requestFullscreen
    ) {
      return
    }
    const touchButtons = document.createElement('div')
    touchButtons.className = 'game-display--touch-buttons is-visible is-right'
    this.wrapper.appendChild(touchButtons)
    const onClick = () => {
      document.documentElement.requestFullscreen()
    }
    const button = createTouchButton(
      onClick,
      'game-display--touch-fullscreen-button'
    )
    touchButtons.appendChild(button)
  }
  get context () {
    return this._context
  }
  get view () {
    return this._context.view
  }
  get wrapper () {
    return this._wrapper
  }
}

function createTouchButton (onClick, className) {
  let button = document.createElement('button')
  button.addEventListener(
    'touchstart',
    e => {
      e.stopPropagation()
    },
    true
  )
  button.onclick = e => {
    e.preventDefault()
    onClick()
  }
  button.className = className
  return button
}

export default GameDisplay
