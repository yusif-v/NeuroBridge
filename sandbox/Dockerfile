FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive DISPLAY=:99 HOME=/home/player LIBGL_ALWAYS_SOFTWARE=1
RUN --mount=type=cache,id=buglens-apt,target=/var/cache/apt \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update && apt-get install -y --no-install-recommends \
    xvfb xdotool openbox imagemagick tesseract-ocr python3 libgl1-mesa-dri \
    libgl1 libxcursor1 libxinerama1 libxrandr2 libxi6 libasound2t64 libpulse0 \
    libfontconfig1 fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN if id ubuntu >/dev/null 2>&1; then userdel ubuntu; fi; useradd -m -u 1000 player
COPY entrypoint.py control.py /opt/buglens/
USER 1000:1000
WORKDIR /game
ENTRYPOINT ["python3", "/opt/buglens/entrypoint.py"]
