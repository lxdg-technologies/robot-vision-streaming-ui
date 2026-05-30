FROM oven/bun:1.1.17

WORKDIR /workspace

COPY shared/ui ./shared/ui
COPY package.json ./vision/robot-vision-streaming-ui/

WORKDIR /workspace/vision/robot-vision-streaming-ui
RUN bun install

COPY . ./

EXPOSE 5173

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
