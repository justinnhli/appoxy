"""A module to create Graphviz diagrams of memory."""

from collections import namedtuple
from itertools import count
from pathlib import Path
from textwrap import indent
from typing import Any, Optional, Sequence, Mapping, Tuple, List, Dict

# pylint: disable = no-name-in-module
from pegparse import create_parser_from_file, ASTWalker

ID_GENERATOR = count()

StackFrame = namedtuple('StackFrame', 'name, namespace')

class Reference(namedtuple('_Reference', 'name')):
    """A pointer/reference."""

    @property
    def is_internal(self):
        # type: () -> bool
        """Get whether the pointer was generated internally."""
        return self.name.startswith('_')

    @property
    def is_null(self):
        # type: () -> bool
        """Get whether the pointer is null."""
        return self.name == '_null'


class TypedValue:
    """A typed value."""

    def __init__(self, value, java_type=None, name=None):
        # type: (Any, Optional[str], Optional[str]) -> None
        """Initialize the TypedValue."""
        self.type = java_type
        self.name = name
        self.value = value

    def __getitem__(self, key):
        # type: (str) -> Any
        return self.value[key]

    def __repr__(self):
        # type: () -> str
        return f'TypedValue({self.type}, {self.name}, {self.value})'

    def __str__(self):
        # type: () -> str
        return f'{self.type} {self.name} = {self.value};'

    @property
    def is_null(self):
        # type: () -> bool
        """Get whether the value is a null pointer."""
        return isinstance(self.value, Reference) and self.value.is_null

    @property
    def is_reference(self):
        # type: () -> bool
        """Get whether the value is a reference."""
        return isinstance(self.value, Reference)

    @property
    def is_array_type(self):
        # type: () -> bool
        """Get whether the variable is an array."""
        return self.type.endswith('[]')

    @property
    def is_array(self):
        # type: () -> bool
        """Get whether the value is an array."""
        return not self.is_reference and isinstance(self.value, tuple)

    @property
    def is_struct_type(self):
        # type: () -> bool
        """Get whether the variable is a struct."""
        return (
            self.type not in ('String', 'char', 'int', 'boolean')
            and not self.is_array_type
        )

    @property
    def is_struct(self):
        # type: () -> bool
        """Get whether the value is a struct."""
        return isinstance(self.value, dict)

    @property
    def is_string_type(self):
        # type: () -> bool
        """Get whether the variable is a String."""
        return self.type == 'String'

    @property
    def is_string(self):
        # type: () -> bool
        """Get whether the value is a struct."""
        return self.type == 'String'

    @property
    def is_primitive(self):
        # type: () -> bool
        """Get whether the value is primitive."""
        return self.type in ('char', 'int', 'boolean')


class MemographWalker(ASTWalker): # type: ignore
    """A Java-like structure parser."""

    def __init__(self):
        # type: () -> None
        """Initialize the MemographWalker."""
        super().__init__(
            create_parser_from_file(Path(__file__).parent / 'memograph.ebnf'),
            'Memory',
        )
        self.stack = [] # type: List[StackFrame]
        self.heap = {} # type: Dict[str, TypedValue]

    def _dereference(self, reference):
        # type: (Reference) -> Optional[TypedValue]
        return self.heap.get(reference.name, None)

    def _check_reference(self, typed_value, path):
        # type: (TypedValue, str) -> None
        referent = self._dereference(typed_value.value)
        if referent is None:
            raise ValueError(f'{path} does not point to an object in the heap: {typed_value.value.name}')
        if not typed_value.value.is_internal and typed_value.type is None:
            typed_value.type = referent.type
        # check that the type of the variable is the same as the type of the value of the referent
        for attr in ('is_array', 'is_struct', 'is_string'):
            if bool(getattr(typed_value, attr + '_type')) ^ bool(getattr(referent, attr)):
                raise ValueError(f'{path} has type {typed_value.type} but points to a {referent.type}')

    def _check_array(self, typed_value, path):
        # type: (TypedValue, str) -> None
        item_types = set()
        for index, item in enumerate(typed_value.value):
            self._check_memory(item, path + f'[{index}]')
            if item.is_reference:
                if item.is_null:
                    continue
                referent = self._dereference(item.value)
                if referent.is_struct:
                    item_types.add('struct')
                elif referent.is_array:
                    item_types.add('array')
                elif referent.is_string:
                    item_types.add('String')
            else:
                item_types.add(item.type)
        if len(item_types) > 1:
            types = ', '.join(sorted(item_types))
            raise ValueError(f'array {path} has heterogeneous items of type: {types}')
        if not item_types:
            return # FIXME ensure array is of pointer type
        item_type = item_types.pop()
        if item_type in ('String', 'char', 'int', 'boolean'):
            if typed_value.type != f'{item_type}[]':
                raise ValueError(f'{path} has type {typed_value.type} but contains {item_type}s')
        # TODO that the array is declared with the correct type
        if 'array' in item_types:
            # TODO check that each inner array is also consistent
            pass

    def _check_struct(self, typed_value, path):
        # type: (TypedValue, str) -> None
        for name, child in typed_value.value.items():
            self._check_memory(child, path + f'.{name}')

    def _check_memory(self, typed_value, path):
        # type: (TypedValue, str) -> None
        if typed_value.is_primitive or typed_value.is_null:
            return
        if typed_value.is_reference:
            self._check_reference(typed_value, path)
        elif typed_value.is_array:
            self._check_array(typed_value, path)
        elif typed_value.is_struct:
            self._check_struct(typed_value, path)

    def _parse_Memory(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Tuple[List[StackFrame], Dict[str, TypedValue]]
        # pylint: disable = no-self-use, unused-argument
        # ensure everything in the heap is an array or a struct
        for name, typed_value in self.heap.items():
            if typed_value.is_array or typed_value.is_struct:
                self._check_memory(typed_value, f'heap variable {name}')
            elif typed_value.is_primitive or typed_value.is_reference:
                raise ValueError(
                    f'top-level heap definitions cannot be primitive, pointers, or null: {typed_value}'
                )
        # ensure all stack pointers point to the heap
        for frame_name, namespace in self.stack:
            for name, typed_value in namespace.items():
                self._check_memory(typed_value, f'stack variable {frame_name}.{name}')
        return self.stack, self.heap

    def _parse_Heap(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> None
        # pylint: disable = no-self-use, unused-argument
        self.heap.update(results[0])
        for name, typed_value in tuple(self.heap.items()):
            if not name.startswith('_') and typed_value.is_reference:
                referent = self._dereference(typed_value.value)
                del self.heap[referent.name]
                referent.name = name
                self.heap[name] = referent

    def _parse_StackFrame(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> None
        # pylint: disable = no-self-use, unused-argument
        self.stack.append(StackFrame(
            name=results[0],
            namespace=results[1],
        ))

    def _parse_Declarations(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Dict[str, TypedValue]
        # pylint: disable = no-self-use, unused-argument
        namespace = {} # type: Dict[str, TypedValue]
        for declaration in results:
            if declaration.name in namespace:
                raise KeyError(f'{declaration.name} is declared multiple times')
            namespace[declaration.name] = declaration
        return namespace

    def _parse_StackFrameName(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> str
        # pylint: disable = no-self-use, unused-argument
        return ast.match

    def _parse_PointerDeclaration(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> TypedValue
        # pylint: disable = no-self-use, unused-argument
        if results[2].is_internal and not results[2].is_null:
            self._dereference(results[2]).type = results[0]
        return TypedValue(results[2], java_type=results[0], name=results[1].name)

    def _parse_PrimitiveDeclaration(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> TypedValue
        # pylint: disable = no-self-use, unused-argument
        typed_value = results[1]
        typed_value.name = results[0].name
        return typed_value

    def _parse_ArrayType(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> str
        # pylint: disable = no-self-use, unused-argument
        return ast.match

    def _parse_StructType(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> str
        # pylint: disable = no-self-use, unused-argument
        return ast.match

    def _parse_StringType(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> str
        # pylint: disable = no-self-use, unused-argument
        return ast.match

    def _parse_Identifier(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Reference
        # pylint: disable = no-self-use, unused-argument
        return Reference(ast.match)

    def _parse_TypedArray(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> List[Any]
        # pylint: disable = no-self-use, unused-argument
        self._dereference(results[1]).type = results[0]
        return results[1]

    def _parse_TypedStruct(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Dict[str, Any]
        # pylint: disable = no-self-use, unused-argument
        self._dereference(results[1]).type = results[0]
        return results[1]

    def _parse_Struct(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Reference
        # pylint: disable = no-self-use, unused-argument
        value = TypedValue(
            {declaration.name: declaration for declaration in results},
            name=f'_struct_{next(ID_GENERATOR)}',
        )
        self.heap[value.name] = value
        return Reference(value.name)

    def _parse_Array(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Reference
        # pylint: disable = no-self-use, unused-argument
        items = []
        for result in results:
            if isinstance(result, TypedValue):
                items.append(result)
            elif isinstance(result, Reference):
                if result.is_internal and not result.is_null:
                    items.append(TypedValue(result, java_type=self._dereference(result).type))
                else:
                    items.append(TypedValue(result))
        value = TypedValue(
            tuple(items),
            java_type='[]',
            name=f'_array_{next(ID_GENERATOR)}',
        )
        self.heap[value.name] = value
        return Reference(value.name)

    def _parse_Null(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Reference
        # pylint: disable = no-self-use, unused-argument
        return Reference('_null')

    def _parse_String(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> Reference
        # pylint: disable = no-self-use, unused-argument
        value = TypedValue(
            ast.match,
            java_type='String',
            name=f'_String_{next(ID_GENERATOR)}',
        )
        self.heap[value.name] = value
        return Reference(value.name)

    def _parse_Char(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> TypedValue
        # pylint: disable = no-self-use, unused-argument
        return TypedValue(ast.match, java_type='char')

    def _parse_Int(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> TypedValue
        # pylint: disable = no-self-use, unused-argument
        return TypedValue(ast.match, java_type='int')

    def _parse_Boolean(self, ast, results): # pylint: disable = invalid-name
        # type: (pegparse.ASTNode, List[Any]) -> TypedValue
        # pylint: disable = no-self-use, unused-argument
        return TypedValue(ast.match, java_type='boolean')


def namespace_to_dot(namespace, title, parent_name, port_prefix, table_wrap=True):
    # type: (Mapping[str, TypedValue], str, str, str) -> Tuple[str, List[str]]
    """Serialize a namespace to Graphviz format."""
    references = [] # type: List[str]
    types = [] # type: List[str]
    values = [] # type: List[tuple[str, str]]
    for name, child in namespace.items():
        port_name = f'_{port_prefix}_{name}'
        types.append(f'{child.type} {name}')
        if child.is_null:
            values.append((port_name, '&empty;'))
        elif child.is_primitive:
            values.append((port_name, child.value))
        else:
            values.append((port_name, ''))
            references.append(f'_{parent_name}:{port_name}:c -> _{child.value.name}:title [tailclip=false]')
    html = []
    if table_wrap:
        html.append('<table border="0" cellspacing="0" bgcolor="#FFFFFF">')
    html.append(f'<tr><td colspan="2" border="1" bgcolor="#C0C0C0" port="title">{title}</td></tr>')
    for child_type, (child_port_name, child_value) in zip(types, values):
        html.append('<tr>')
        html.append(f'<td border="1" align="left">{child_type}</td>')
        html.append(f'<td border="1" port="{child_port_name}">{child_value}</td>')
        html.append('</tr>')
    if table_wrap:
        html.append('</table>')
    return ''.join(html), references


def stack_to_dot(stack):
    # type: (Sequence[StackFrame]) -> Tuple[List[str], List[str]]
    """Serialize the stack to Graphviz format."""
    if not stack:
        return [], []
    references = [] # type: List[str]
    results = [] # type: List[str]
    for index, (frame_name, frame) in enumerate(stack):
        frame_dot, new_references = namespace_to_dot(
            frame,
            frame_name,
            '',
            f'stack_{index}',
            table_wrap=False,
        )
        results.append(frame_dot)
        references.extend(new_references)
    dot = '_ [shape="none", label=<<table border="0" cellspacing="0" bgcolor="#FFFFFF">' + ''.join(results) + '</table>>]'
    return [dot], references


def string_to_dot(typed_value):
    # type: (TypedValue) -> Tuple[List[str], List[str]]
    """Serialize a String object to Graphviz format."""
    string = typed_value.value[1:-1].replace('"', r'\"')
    dot = f'_{typed_value.name} [shape="none", label=<<table border="0" cellspacing="0" bgcolor="#FFFFFF"><tr><td border="1" bgcolor="#C0C0C0" port="title">String</td></tr><tr><td border="1">"{string}"</td></tr></table>>]'
    return [dot], []


def array_to_dot(typed_value):
    # type: (TypedValue) -> Tuple[List[str], List[str]]
    """Serialize an array to Graphviz format."""
    # pylint: disable = f-string-without-interpolation
    references = [] # type: List[str]
    values = [] # type: list[str]
    items = [] # type: List[str]
    for index, child in enumerate(typed_value.value):
        if child.is_null:
            values.append('&empty')
        elif child.is_primitive:
            values.append(child.value)
        else:
            values.append('')
            references.append(f'_{typed_value.name}:{index}:c -> _{child.value.name}:title [tailclip=false]')
    html = []
    html.append('<table border="0" cellspacing="0" bgcolor="#FFFFFF">')
    html.append(f'<tr><td colspan="{len(values)}" border="1" bgcolor="#C0C0C0" port="title">{typed_value.type}</td></tr>')
    html.append('<tr>')
    for index, _ in enumerate(values):
        html.append(f'<td border="1">{index}</td>')
    html.append('</tr>')
    html.append('<tr>')
    for index, value in enumerate(values):
        html.append(f'<td border="1" port="{index}">{value}</td>')
    html.append('</tr>')
    html.append('</table>')
    dot = f'_{typed_value.name} [shape="none", label=<' + ''.join(html) + '>]'
    return [dot], references


def struct_to_dot(typed_value):
    # type: (TypedValue) -> Tuple[List[str], List[str]]
    """Serialize an object to Graphviz format."""
    # pylint: disable = f-string-without-interpolation
    html, references = namespace_to_dot(
        typed_value.value,
        typed_value.type,
        typed_value.name,
        '',
    )
    dot = f'_{typed_value.name} [shape="none", label=<{html}>]'
    return [dot], references


def heap_to_dot(heap):
    # type: (Mapping[str, TypedValue]) -> Tuple[List[str], List[str]]
    """Serialize the heap to Graphviz format."""
    dot = [] # type: List[str]
    references = [] # type: List[str]
    for typed_value in heap.values():
        if typed_value.is_reference:
            continue
        if typed_value.type == 'String':
            new_dot, new_references = string_to_dot(typed_value)
        elif typed_value.is_array:
            new_dot, new_references = array_to_dot(typed_value)
        else:
            new_dot, new_references = struct_to_dot(typed_value)
        dot.extend(new_dot)
        references.extend(new_references)
    return dot, references


def memory_to_dot(stack, heap):
    # type: (Sequence[StackFrame], Mapping[str, TypedValue]) -> None
    """Print the stack and the heap."""
    references = [] # type: List[str]
    stack_dot, stack_references = stack_to_dot(stack)
    references.extend(stack_references)
    heap_dot, heap_references = heap_to_dot(heap)
    references.extend(heap_references)
    output = []
    output.append('digraph {')
    output.append(indent('rankdir="LR"', 4 * ' '))
    output.append(indent('node [fontsize=10]', 4 * ' '))
    output.append(indent('subgraph cluster_stack {', 4 * ' '))
    output.append(indent('label="STACK"', 8 * ' '))
    output.append(indent('pencolor="#A0A0A0"', 8 * ' '))
    output.append(indent('bgcolor="#F0F0F0"', 8 * ' '))
    output.append(indent('\n'.join(stack_dot), 8 * ' '))
    output.append(indent('}', 4 * ' '))
    output.append(indent('subgraph cluster_heap {', 4 * ' '))
    output.append(indent('label="HEAP"', 8 * ' '))
    output.append(indent('pencolor="#A0A0A0"', 8 * ' '))
    output.append(indent('bgcolor="#F0F0F0"', 8 * ' '))
    output.append(indent('\n'.join(heap_dot), 8 * ' '))
    output.append(indent('}', 4 * ' '))
    output.append(indent('\n'.join(references), 4 * ' '))
    output.append('}')
    return '\n'.join(output)


def main():
    # type: () -> None
    """Parse a file and print its memory layout."""
    import sys
    mem_parser = MemographWalker()
    with open(sys.argv[1]) as fd:
        print(memory_to_dot(*mem_parser.parse(fd.read())))


if __name__ == '__main__':
    main()
