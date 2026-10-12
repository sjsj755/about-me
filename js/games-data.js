// ============ 游戏室 · 游戏清单（纯数据，无逻辑） ============
// 加一款游戏：
//   ① 下面 GAMES 里加一条元信息（id 必须唯一，且与实现同名）
//      { id: 'snake', name: '贪吃蛇', tag: '经典', desc: '方向键控制，吃到果子变长。' }
//      name 是 tab 上的文字；tag 可选（渲染成 chip 上的小标签）；desc 可选（渲染到舞台下方说明行）
//   ② 实现二选一：
//      a) 直接写进 js/games.js 末尾的 GAME_RUNNERS；
//      b) 另建 js/games-<id>.js，写 window.GAME_RUNNERS['<id>'] = { mount(ctx) { … } }，
//         并在 games.html 的 games.js 之前加一行 <script>（同样 defer、带 ?v=版本号）
//   ③ 实现契约与 ctx 能力表见 js/games.js 文件头
//
// 说明：清单为空时游戏页显示空态（切换条隐藏），页面仍然可正常访问。
window.GAMES = [];
