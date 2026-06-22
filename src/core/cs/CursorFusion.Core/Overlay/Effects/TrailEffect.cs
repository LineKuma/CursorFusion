using SkiaSharp;

namespace CursorFusion.Core.Overlay.Effects;

/// <summary>
/// 拖尾特效 — 鼠标移动时产生渐隐拖尾
/// </summary>
public class TrailEffect : IEffect
{
    public string Name => "Trail";

    private readonly Queue<(float X, float Y, float Age)> _trail = new();
    private readonly SKColor _color;
    private readonly int _maxTrailLength;
    private readonly float _trailLifetime;

    public TrailEffect(SKColor? color = null, int maxTrailLength = 20, float trailLifetime = 0.5f)
    {
        _color = color ?? new SKColor(0, 200, 255);
        _maxTrailLength = maxTrailLength;
        _trailLifetime = trailLifetime;
    }

    public void Render(SKCanvas canvas, int mouseX, int mouseY, float deltaTime)
    {
        _trail.Enqueue((mouseX, mouseY, 0));

        // 更新拖尾年龄
        var updated = new Queue<(float X, float Y, float Age)>();
        while (_trail.Count > 0)
        {
            var point = _trail.Dequeue();
            point.Age += deltaTime;
            if (point.Age < _trailLifetime)
                updated.Enqueue(point);
        }
        while (updated.Count > 0)
            _trail.Enqueue(updated.Dequeue());

        // 限制最大长度
        while (_trail.Count > _maxTrailLength)
            _trail.Dequeue();

        // 渲染拖尾
        var i = 0;
        foreach (var point in _trail)
        {
            var progress = point.Age / _trailLifetime;
            var alpha = (byte)(180 * (1f - progress));
            var radius = 6f * (1f - progress * 0.7f);

            var relX = point.X - mouseX;
            var relY = point.Y - mouseY;

            using var paint = new SKPaint
            {
                Style = SKPaintStyle.Fill,
                IsAntialias = true,
                Color = _color.WithAlpha(alpha),
            };

            canvas.DrawCircle(relX, relY, radius, paint);
            i++;
        }
    }
}