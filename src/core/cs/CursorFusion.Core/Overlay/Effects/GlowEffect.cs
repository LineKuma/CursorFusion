using SkiaSharp;

namespace CursorFusion.Core.Overlay.Effects;

/// <summary>
/// 光晕特效 — 在光标周围渲染渐变光晕
/// </summary>
public class GlowEffect : IEffect
{
    public string Name => "Glow";

    private readonly SKColor _color;
    private readonly float _radius;
    private float _time;

    public GlowEffect(SKColor? color = null, float radius = 48f)
    {
        _color = color ?? SKColors.Cyan;
        _radius = radius;
    }

    public void Render(SKCanvas canvas, int mouseX, int mouseY, float deltaTime)
    {
        _time += deltaTime;

        var pulse = 1f + 0.15f * MathF.Sin(_time * 3f);

        using var paint = new SKPaint
        {
            Style = SKPaintStyle.Fill,
            IsAntialias = true,
        };

        // 三层渐变叠加
        for (int i = 3; i >= 0; i--)
        {
            var r = _radius * pulse * (1f - i * 0.15f);
            var alpha = (byte)(60 - i * 15);

            paint.Shader = SKShader.CreateRadialGradient(
                new SKPoint(0, 0),
                r,
                new[] { _color.WithAlpha(alpha), _color.WithAlpha(0) },
                new[] { 0f, 1f },
                SKShaderTileMode.Clamp
            );

            canvas.DrawCircle(0, 0, r, paint);
        }
    }
}