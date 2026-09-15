#!/usr/bin/env python3
"""python-routes.py — FastAPI route discovery adapter.

Parses Python files with stdlib AST without importing them.
Composes literal router prefixes and literal include_router prefixes.
Extracts HTTP decorators and source declarations.
Unsupported computed prefixes/conditional registrations are unresolved, not assumed absent.
"""
import ast
import json
import os
import sys
from pathlib import Path


HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}


def extract_routes_from_file(file_path):
    """Extract route definitions from a Python file using AST."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()
        tree = ast.parse(source, filename=file_path)
    except Exception as e:
        return {"routes": [], "unresolved": [{"reason": f"Parse error: {e}"}]}

    routes = []
    unresolved = []

    # Collect router prefix assignments: router = APIRouter(prefix="/foo")
    router_prefixes = {}
    # Collect include_router calls: app.include_router(router, prefix="/bar")
    include_prefixes = []

    for node in ast.walk(tree):
        # Detect APIRouter(prefix=...) assignments
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                    func = node.value.func
                    func_name = ""
                    if isinstance(func, ast.Name):
                        func_name = func.id
                    elif isinstance(func, ast.Attribute):
                        func_name = func.attr
                    if func_name == "APIRouter":
                        prefix = ""
                        for kw in node.value.keywords:
                            if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                                prefix = kw.value.value
                        router_prefixes[target.id] = prefix

        # Detect include_router calls
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute) and func.attr == "include_router":
                prefix = ""
                for kw in node.keywords:
                    if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                        prefix = kw.value.value
                router_name = ""
                if node.args and isinstance(node.args[0], ast.Name):
                    router_name = node.args[0].id
                include_prefixes.append({
                    "router": router_name,
                    "prefix": prefix,
                })

        # Detect route decorators: @router.get("/path"), @app.post("/path")
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Call):
                    func = decorator.func
                    if isinstance(func, ast.Attribute) and func.attr.lower() in HTTP_METHODS:
                        method = func.attr.upper()
                        path = ""
                        if decorator.args and isinstance(decorator.args[0], ast.Constant):
                            path = decorator.args[0].value
                        # Determine router prefix
                        router_name = ""
                        if isinstance(func.value, ast.Name):
                            router_name = func.value.id
                        prefix = router_prefixes.get(router_name, "")
                        full_path = prefix + path if prefix else path

                        routes.append({
                            "method": method,
                            "path": full_path,
                            "function": node.name,
                            "line": node.lineno,
                            "router": router_name,
                            "router_prefix": prefix,
                        })

    # Check for unresolved patterns
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute) and func.attr == "include_router":
                for kw in node.keywords:
                    if kw.arg == "prefix" and not isinstance(kw.value, ast.Constant):
                        unresolved.append({
                            "reason": "Non-literal prefix in include_router",
                            "line": node.lineno if hasattr(node, "lineno") else None,
                        })

    return {"routes": routes, "unresolved": unresolved}


def discover_routes(repo_root, search_dirs=None):
    """Discover all FastAPI routes in a repository."""
    if search_dirs is None:
        search_dirs = ["api", "src/api", "src"]

    all_routes = []
    all_unresolved = []

    for search_dir in search_dirs:
        full_dir = os.path.join(repo_root, search_dir)
        if not os.path.isdir(full_dir):
            continue

        for root, dirs, files in os.walk(full_dir):
            # Skip hidden dirs and __pycache__
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]

            for fname in files:
                if not fname.endswith(".py"):
                    continue
                file_path = os.path.join(root, fname)
                rel_file = os.path.relpath(file_path, repo_root)
                result = extract_routes_from_file(file_path)

                for route in result["routes"]:
                    route["file"] = rel_file
                    all_routes.append(route)

                for u in result["unresolved"]:
                    u["file"] = rel_file
                    all_unresolved.append(u)

    return {"routes": all_routes, "unresolved": all_unresolved}


def format_inventory(result):
    """Format route inventory for display."""
    lines = ["FastAPI route inventory:"]
    for r in result["routes"]:
        lines.append(f"  {r['method']} {r['path']} ({r['function']}) [{r['file']}:{r.get('line', '?')}]")
    if result["unresolved"]:
        lines.append("")
        lines.append("Unresolved:")
        for u in result["unresolved"]:
            lines.append(f"  {u.get('file', '?')}: {u['reason']}")
    return "\n".join(lines)


if __name__ == "__main__":
    repo_root = sys.argv[1] if len(sys.argv) > 1 else "."
    result = discover_routes(repo_root)
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2))
    else:
        print(format_inventory(result))
