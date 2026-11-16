#include "platform.hpp"
#include <filesystem>
#include <type_traits>

#ifdef _WIN32
#include <Windows.h>
#endif

#ifdef _WIN32
template<typename T>
static std::optional<T> ReadRegistry(HKEY key, const std::string &path, const std::string &value)
{
	static char buf[0xffff];

	DWORD   type   = REG_NONE;
	DWORD   len    = sizeof(buf);
	LSTATUS result = RegGetValue(
	    key,
	    path.c_str(),
	    value.c_str(),
	    RRF_RT_ANY,
	    &type,
	    buf,
	    &len
	);
	if (result != ERROR_SUCCESS)
		return std::nullopt;

	switch (type)
	{
		case REG_SZ:
		case REG_EXPAND_SZ:
		case REG_BINARY:
		{
			// Remove nullbyte
			if (len > 0 && buf[len - 1] == '\0')
				len--;

			if constexpr (std::is_same_v<T, std::string>)
				return std::string(buf, len);
			else if constexpr (std::is_same_v<T, std::filesystem::path>)
				return std::filesystem::path(std::string(buf, len));
			return std::nullopt;
		}
		case REG_DWORD_LITTLE_ENDIAN:
		case REG_DWORD_BIG_ENDIAN:
		{
			static_assert(REG_DWORD == REG_DWORD_LITTLE_ENDIAN);
			if constexpr (std::is_same_v<T, int32_t> || std::is_same_v<T, uint32_t>)
				return *reinterpret_cast<T *>(buf);
			return std::nullopt;
		}
		case REG_LINK:
		case REG_MULTI_SZ:
		case REG_RESOURCE_LIST:
		case REG_FULL_RESOURCE_DESCRIPTOR:
		case REG_RESOURCE_REQUIREMENTS_LIST:
		{
			return std::nullopt;
		}
		case REG_QWORD_LITTLE_ENDIAN:
		{
			static_assert(REG_QWORD == REG_QWORD_LITTLE_ENDIAN);
			if constexpr (std::is_same_v<T, int64_t> || std::is_same_v<T, uint64_t>)
				return *reinterpret_cast<T *>(buf);
			return std::nullopt;
		}
		default:
		{
			return std::nullopt;
		}
	}
}
#endif

std::optional<std::filesystem::path> Platform::GetSteamInstallPath()
{
#ifdef _WIN32
	if (auto installPath = ReadRegistry<std::filesystem::path>(HKEY_LOCAL_MACHINE, "SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"))
		return installPath;

	if (auto installPath = ReadRegistry<std::filesystem::path>(HKEY_CURRENT_USER, "SOFTWARE\\Valve\\Steam", "SteamPath"))
		return installPath;

	return std::nullopt;
#else
	const char *home = std::getenv("HOME");
	if (home)
		return std::filesystem::path(home) / ".steam" / "steam";
	return std::nullopt;
#endif
}
