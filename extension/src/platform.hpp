#pragma once

#include <filesystem>
#include <optional>

#ifdef _WIN32
#define EXPORT extern "C" __declspec(dllexport)
#else
#define EXPORT extern "C" __attribute__((visibility("default")))
#endif

namespace Platform
{
	std::optional<std::filesystem::path> GetSteamInstallPath();
}
