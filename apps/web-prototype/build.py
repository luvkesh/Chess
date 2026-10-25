import pathlib
src = pathlib.Path(__file__).parent / 'src'
html = (src / 'shell.html').read_text()
for key, name in [('ENGINE', 'engine.js'), ('RENDER', 'render.js'), ('APP', 'app.js')]:
    code = (src / name).read_text()
    if key == 'ENGINE':
        code = code.replace("if (typeof module !== 'undefined') module.exports = ChacklateEngine;", '')
    assert '</script' not in code
    html = html.replace('/*' + key + '*/', code)
out = pathlib.Path(__file__).parent / 'dist' / 'chacklate-chess.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html))
