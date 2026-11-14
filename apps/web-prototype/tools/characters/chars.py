"""The cast: one file per character in cast/<animal>.py, each with build(). CHARS maps a name to
its builder and loads the file only when asked, so a broken character never blocks another."""
import importlib

NAMES = ['horse', 'bunny', 'raccoon', 'panda', 'beaver', 'squirrel', 'cat', 'wolf', 'bear', 'lion', 'elephant', 'giraffe', 'raven', 'owl', 'rooster', 'eagle', 'tortoise', 'dragon']


class _Cast(dict):
    def __missing__(self, name):
        if name not in NAMES:
            raise KeyError(name)
        self[name] = importlib.import_module('cast.' + name).build
        return self[name]


CHARS = _Cast()
