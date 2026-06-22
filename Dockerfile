# Multi-stage build for CursorFusion Desktop App
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

COPY src/core/cs/ ./src/core/cs/

RUN dotnet publish src/core/cs/CursorFusion.App/CursorFusion.App.csproj \
    --configuration Release \
    --output /app/dist

# Runtime stage
FROM mcr.microsoft.com/dotnet/runtime:8.0 AS runner

RUN addgroup -S -g 1001 cursorfusion \
    && adduser -S -u 1001 -G cursorfusion -s /bin/sh -d /app cursorfusion

WORKDIR /app

COPY --from=builder --chown=cursorfusion:cursorfusion /app/dist ./

USER cursorfusion

ENTRYPOINT ["./CursorFusion.App"]
CMD ["--help"]