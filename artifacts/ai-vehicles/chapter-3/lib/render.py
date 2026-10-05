"""第三章真实预览入口：复用公共渲染器，输入与输出目录由调用者明确指定。"""
import pathlib
import runpy

runpy.run_path(str(pathlib.Path(__file__).resolve().parents[2] / 'chapter-2/lib/render.py'), run_name='__main__')
