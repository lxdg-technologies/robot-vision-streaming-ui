FROM oven/bun:1.1.17

ARG SHARED_REPO=shared

WORKDIR /workspace

COPY ${SHARED_REPO}/ui ./shared/ui
COPY vision/robot-vision-streaming-ui/package.json ./vision/robot-vision-streaming-ui/

WORKDIR /workspace/vision/robot-vision-streaming-ui
RUN bun install

COPY vision/robot-vision-streaming-ui ./

EXPOSE 5173

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
