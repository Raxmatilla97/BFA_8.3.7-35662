# syntax=docker/dockerfile:1
#
# TrinityCore (BfA 8.3.7) uchun ko'p bosqichli (multi-stage) Docker image.
#
# Bosqichlar:
#   builder      - butun manba kodni kompilyatsiya qiladi (bnetserver, worldserver,
#                   map/vmap/mmap extractor asboblari)
#   runtime-base - ishga tushirish uchun kerakli umumiy kutubxonalar
#   bnetserver   - faqat bnetserver binarnigi + kerakli fayllar
#   worldserver  - faqat worldserver binarnigi + kerakli fayllar
#   tools        - mapextractor/vmap4extractor/vmap4assembler/mmaps_generator
#                  (mijoz fayllaridan xarita ma'lumotlarini ajratib olish uchun)
#
# ESLATMA: To'liq build juda ko'p vaqt (odatda 30-90+ daqiqa, kompyuter
# tezligiga qarab) va xotira (kamida 4-8 GB tavsiya etiladi) talab qiladi.

# DIQQAT: aynan Ubuntu 20.04 (OpenSSL 1.1.1) ishlatiladi - TrinityCore-ning
# ushbu versiyasi (cmake/macros/FindOpenSSL.cmake) OpenSSL 3.x ni QO'LLAMAYDI
# (build FATAL_ERROR bilan to'xtaydi). 22.04/24.04 kabi yangiroq Ubuntu'lar
# standart OpenSSL 3.0 bilan keladi - shuning uchun ishlatilmaydi.
FROM ubuntu:20.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ARG JOBS=4

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      cmake \
      make \
      gcc \
      g++ \
      clang \
      default-libmysqlclient-dev \
      libssl-dev \
      libbz2-dev \
      libreadline-dev \
      libncurses-dev \
      zlib1g-dev \
      libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/trinitycore
COPY . .

RUN mkdir -p build && cd build && \
    cmake .. \
      -DCMAKE_INSTALL_PREFIX=/opt/trinitycore \
      -DCMAKE_BUILD_TYPE=RelWithDebInfo \
      -DSERVERS=1 \
      -DTOOLS=1 \
      -DSCRIPTS=static \
      -DWITH_WARNINGS=0 \
    && make -j"${JOBS}" \
    && make install

# ---------------------------------------------------------------------------
# runtime ham xuddi shu Ubuntu 20.04 (OpenSSL 1.1.1) bo'lishi shart - builder'da
# OpenSSL 1.1 bilan bog'langan (linked) binary'lar 3.0 bilan mos kelmaydi.
FROM ubuntu:20.04 AS runtime-base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      libmariadb3 \
      default-mysql-client \
      libssl1.1 \
      libbz2-1.0 \
      libreadline8 \
      libncurses6 \
      zlib1g \
      openssl \
      ca-certificates \
      netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM runtime-base AS bnetserver

COPY --from=builder /opt/trinitycore/bin/bnetserver /opt/trinitycore/bin/bnetserver
COPY --from=builder /opt/trinitycore/etc/bnetserver.conf.dist /opt/trinitycore/etc/bnetserver.conf.dist
COPY --from=builder /usr/src/trinitycore/sql /usr/src/trinitycore/sql
COPY docker/scripts/entrypoint-bnetserver.sh /entrypoint.sh
COPY docker/scripts/wait-for-mysql.sh /usr/local/bin/wait-for-mysql.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/wait-for-mysql.sh

WORKDIR /opt/trinitycore/bin
EXPOSE 1119 8081
ENTRYPOINT ["/entrypoint.sh"]

# ---------------------------------------------------------------------------
FROM runtime-base AS worldserver

COPY --from=builder /opt/trinitycore/bin/worldserver /opt/trinitycore/bin/worldserver
COPY --from=builder /opt/trinitycore/etc/worldserver.conf.dist /opt/trinitycore/etc/worldserver.conf.dist
COPY --from=builder /usr/src/trinitycore/sql /usr/src/trinitycore/sql
COPY docker/scripts/entrypoint-worldserver.sh /entrypoint.sh
COPY docker/scripts/wait-for-mysql.sh /usr/local/bin/wait-for-mysql.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/wait-for-mysql.sh

WORKDIR /opt/trinitycore/bin
EXPOSE 8085
ENTRYPOINT ["/entrypoint.sh"]

# ---------------------------------------------------------------------------
FROM runtime-base AS tools

COPY --from=builder /opt/trinitycore/bin/mapextractor /opt/trinitycore/bin/mapextractor
COPY --from=builder /opt/trinitycore/bin/vmap4extractor /opt/trinitycore/bin/vmap4extractor
COPY --from=builder /opt/trinitycore/bin/vmap4assembler /opt/trinitycore/bin/vmap4assembler
COPY --from=builder /opt/trinitycore/bin/mmaps_generator /opt/trinitycore/bin/mmaps_generator
ENV PATH="/opt/trinitycore/bin:${PATH}"

WORKDIR /data
ENTRYPOINT ["/bin/bash"]
