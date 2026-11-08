# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-jammy AS base

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Android SDK Command-line Tools
ARG CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    curl -fsSL ${CMDLINE_TOOLS_URL} -o /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

# Accept licenses and install platform tools, compileSdk 37, and build-tools 36.0.0
RUN yes | sdkmanager --licenses > /dev/null && \
    sdkmanager --install \
    "platform-tools" \
    "platforms;android-37.0" \
    "build-tools;36.0.0"

WORKDIR /workspace/apps/mobile

# Copy wrapper and configurations
COPY apps/mobile/gradlew apps/mobile/gradlew.bat ./
COPY apps/mobile/gradle ./gradle
COPY apps/mobile/gradle.properties ./
COPY apps/mobile/build.gradle.kts ./
COPY apps/mobile/settings.gradle.kts ./
RUN chmod +x ./gradlew

FROM base AS test
COPY apps/mobile ./
CMD ["./gradlew", ":shared:testAndroidHostTest", "--no-daemon"]

FROM base AS build
COPY apps/mobile ./
CMD ["./gradlew", ":androidApp:assembleDebug", "--no-daemon"]
