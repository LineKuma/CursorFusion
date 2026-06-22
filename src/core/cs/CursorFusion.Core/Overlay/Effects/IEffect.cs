using SkiaSharp;

namespace CursorFusion.Core.Overlay.Effects;

/// <summary>
/// 光标叠加特效接口 — 扩展实现自定义渲染效果
/// </summary>
public interface IEffect
{
    /// <summary>特效名称</summary>
    string Name { get; }

    /// <summary>每帧渲染</summary>
    /// <param name="canvas">SkiaSharp 画布，原点在光标位置</param>
    /// <param name="mouseX">鼠标 X</param>
    /// <param name="mouseY">鼠标 Y</param>
    /// <param name="deltaTime">帧间隔 (秒)</param>
    void Render(SKCanvas canvas, int mouseX, int mouseY, float deltaTime);
}