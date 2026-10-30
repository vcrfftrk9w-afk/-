"""A small Luau sanity checker: block structure, brackets, JS-isms and unknown names.
It is not a full parser; it catches the mistakes that are easy to make when no Roblox
tooling is available. Usage: python3 tools/check_luau.py src
"""
import os
import re
import sys

KEYWORDS = {
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in',
    'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue',
}
GLOBALS = {
    'game', 'workspace', 'script', 'Instance', 'Vector2', 'Vector3', 'UDim', 'UDim2', 'Color3',
    'ColorSequence', 'ColorSequenceKeypoint', 'NumberSequence', 'NumberSequenceKeypoint', 'Enum',
    'Random', 'TweenInfo', 'Font', 'Content', 'buffer', 'math', 'string', 'table', 'task', 'typeof',
    'type', 'tostring', 'tonumber', 'pairs', 'ipairs', 'setmetatable', 'getmetatable', 'pcall', 'error',
    'print', 'warn', 'xpcall', 'os', 'utf8', 'bit32', 'require', 'select', 'next', 'unpack', 'assert', 'rawget',
    'rawset', 'coroutine', 'debug', 'self', 'shared', 'tick', 'time', 'Rect', 'CFrame', 'BrickColor',
    # type names used in annotations
    'number', 'boolean', 'any', 'Player', 'PlayerGui', 'RemoteEvent', 'GuiObject', 'InputObject',
    'Camera', 'Ray', 'Part', 'BasePart', 'MeshPart', 'Folder', 'Model', 'Instance', 'Terrain', 'Frame', 'Region3', 'RaycastParams',
}
EXPR_PREV = {
    '=', '(', ',', 'return', '{', '[', '..', '+', '-', '*', '/', '//', '%', '^', 'and', 'or', 'not',
    '==', '~=', '<', '>', '<=', '>=', 'in', '+=', '-=', '*=', '/=', '..=', '%=', '//=', '^=', 'if',
    'elseif', 'while', 'until', '#',
}
OPS = ['...', '..=', '//=', '..', '==', '~=', '<=', '>=', '//', '->', '::', '+=', '-=', '*=', '/=', '%=', '^=']
BAD = {'!=': 'use ~=', '&&': 'use and', '||': 'use or', '===': 'use ==', '++': 'no ++ in Luau', '=>': 'no arrow functions', '?.': 'no optional chaining', '??': 'no ?? operator'}


def tokenize(src):
    toks = []  # (kind, value, line)
    i, line, n = 0, 1, len(src)
    while i < n:
        c = src[i]
        if c == '\n':
            line += 1
            i += 1
            continue
        if c in ' \t\r':
            i += 1
            continue
        if src.startswith('--', i):
            m = re.match(r'--\[(=*)\[', src[i:])
            if m:
                close = ']' + m.group(1) + ']'
                j = src.find(close, i)
                if j < 0:
                    raise SyntaxError(f'{line}: unclosed long comment')
                line += src.count('\n', i, j)
                i = j + len(close)
            else:
                j = src.find('\n', i)
                i = n if j < 0 else j
            continue
        m = re.match(r'\[(=*)\[', src[i:])
        if m:
            close = ']' + m.group(1) + ']'
            j = src.find(close, i)
            if j < 0:
                raise SyntaxError(f'{line}: unclosed long string')
            line += src.count('\n', i, j)
            toks.append(('str', '', line))
            i = j + len(close)
            continue
        if c in '"\'`':
            j = i + 1
            while j < n and src[j] != c:
                if src[j] == '\\':
                    j += 1
                elif src[j] == '\n' and c != '`':
                    raise SyntaxError(f'{line}: newline in string')
                j += 1
            if j >= n:
                raise SyntaxError(f'{line}: unclosed string')
            toks.append(('str', src[i + 1:j], line))
            line += src.count('\n', i, j)
            i = j + 1
            continue
        m = re.match(r'0[xX][0-9a-fA-F_]+|0[bB][01_]+|(\d[\d_]*\.?[\d_]*|\.\d[\d_]*)([eE][+-]?\d+)?', src[i:])
        if m and m.group(0):
            toks.append(('num', m.group(0), line))
            i += len(m.group(0))
            continue
        m = re.match(r'[A-Za-z_][A-Za-z0-9_]*', src[i:])
        if m:
            w = m.group(0)
            toks.append(('kw' if w in KEYWORDS else 'name', w, line))
            i += len(w)
            continue
        for bad in ('===', '!=', '&&', '||', '++', '=>', '?.', '??'):
            if src.startswith(bad, i):
                raise SyntaxError(f'{line}: "{bad}" ({BAD[bad]})')
        for op in OPS:
            if src.startswith(op, i):
                toks.append(('op', op, line))
                i += len(op)
                break
        else:
            if c in '!':
                raise SyntaxError(f'{line}: "!" is not Luau')
            toks.append(('op', c, line))
            i += 1
    return toks


def check_blocks(toks, errors):
    stack = []
    pending_do = 0
    last_else_expr = False
    brackets = []
    prev = None
    pairs_ = {')': '(', ']': '[', '}': '{'}
    for kind, v, line in toks:
        if kind == 'op' and v in '([{':
            brackets.append((v, line))
        elif kind == 'op' and v in ')]}':
            if not brackets or brackets[-1][0] != pairs_[v]:
                errors.append(f'{line}: unbalanced "{v}"')
                return
            brackets.pop()
        if kind == 'kw':
            top = stack[-1][0] if stack else None
            if v == 'function':
                stack.append(('function', line))
            elif v == 'if':
                p = prev[1] if prev else None
                is_expr = (p in EXPR_PREV and not (prev and prev[0] == 'str')) or (p == 'then' and top == 'ifx') or (p == 'else' and last_else_expr)
                stack.append(('ifx' if is_expr else 'if', line))
            elif v == 'elseif':
                if top not in ('if', 'ifx'):
                    errors.append(f'{line}: elseif without if')
            elif v == 'else':
                if top == 'ifx':
                    stack.pop()
                    last_else_expr = True
                elif top == 'if':
                    last_else_expr = False
                else:
                    errors.append(f'{line}: else without if')
            elif v in ('for', 'while'):
                stack.append(('loop', line))
                pending_do += 1
            elif v == 'do':
                if pending_do > 0:
                    pending_do -= 1
                else:
                    stack.append(('do', line))
            elif v == 'repeat':
                stack.append(('repeat', line))
            elif v == 'until':
                if top != 'repeat':
                    errors.append(f'{line}: until without repeat')
                else:
                    stack.pop()
            elif v == 'end':
                if top not in ('function', 'if', 'loop', 'do'):
                    errors.append(f'{line}: unexpected end (open: {stack[-3:]})')
                    return
                stack.pop()
        prev = (kind, v, line)
    if stack:
        errors.append(f'unclosed blocks: {stack[-5:]}')
    if brackets:
        errors.append(f'unclosed brackets: {brackets[-5:]}')


def check_names(toks, errors, warnings):
    declared = set(GLOBALS)
    n = len(toks)
    # declarations: local names, function names/params, loop variables
    for i, (kind, v, line) in enumerate(toks):
        if v == 'local' or v == 'for':
            j = i + 1
            if j < n and toks[j][1] == 'function':
                j += 1
            depth = 0
            while j < n:
                k2, v2, _ = toks[j]
                if v2 in ('=', 'in', 'do') or (k2 == 'kw' and v2 not in ('function',)):
                    break
                if v2 in ('(', '{', '<'):
                    depth += 1
                elif v2 in (')', '}', '>'):
                    depth -= 1
                elif k2 == 'name' and depth == 0 and toks[j - 1][1] in (',', 'local', 'for', 'function'):
                    declared.add(v2)
                if toks[j][2] != line and depth == 0:
                    break
                j += 1
        if v == 'function':
            j = i + 1
            if j < n and toks[j][0] == 'name':
                declared.add(toks[j][1])
            while j < n and toks[j][1] != '(':
                j += 1
            depth = 0
            while j < n:
                v2 = toks[j][1]
                if v2 == '(':
                    depth += 1
                elif v2 == ')':
                    depth -= 1
                    if depth == 0:
                        break
                elif toks[j][0] == 'name' and depth == 1 and toks[j - 1][1] in ('(', ','):
                    declared.add(v2)
                j += 1
    # uses
    for i, (kind, v, line) in enumerate(toks):
        if kind != 'name' or v in declared:
            continue
        p = toks[i - 1][1] if i else ''
        nx = toks[i + 1][1] if i + 1 < n else ''
        if p in ('.', ':', '::') or (nx == '=' and p in ('{', ',', ';')):
            continue
        if p == ':' or p == '->':
            continue
        warnings.append(f'{line}: unknown name "{v}"')


def main(root):
    bad = 0
    for dirpath, _, files in os.walk(root):
        for f in sorted(files):
            if not f.endswith('.luau'):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding='utf-8').read()
            errors, warnings = [], []
            try:
                toks = tokenize(src)
                check_blocks(toks, errors)
                check_names(toks, errors, warnings)
            except SyntaxError as e:
                errors.append(str(e))
            for e in errors:
                print(f'ERROR {path}:{e}')
            seen = set()
            for w in warnings:
                key = w.split('"')[1]
                if key not in seen:
                    seen.add(key)
                    print(f'warn  {path}:{w}')
            bad += len(errors)
    print('errors:', bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'src'))
