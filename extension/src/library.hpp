#pragma once

#include <cstring>
#include <type_traits>

#ifdef _WIN32
#include <Windows.h>
#else
#include <dlfcn.h>
#endif

class Library
{
public:
	using CreateInterfaceFn = void *(*)(const char *, int *);

private:
	void             *m_lib;
	CreateInterfaceFn m_createInterface;

public:
	Library()
	    : m_lib(nullptr),
	      m_createInterface(nullptr)
	{
	}

	~Library()
	{
		Close();
	}

	void Close()
	{
		if (m_lib)
		{
#ifdef _WIN32
			FreeLibrary(reinterpret_cast<HMODULE>(m_lib));
#else
			dlclose(m_lib);
#endif
		}
		m_lib             = nullptr;
		m_createInterface = nullptr;
	}

	bool Open(const char *name)
	{
		Close();

#ifdef _WIN32
		if (std::strchr(name, '/') || std::strchr(name, '\\'))
			m_lib = reinterpret_cast<void *>(LoadLibraryEx(name, NULL, LOAD_WITH_ALTERED_SEARCH_PATH));
		else
			m_lib = reinterpret_cast<void *>(LoadLibrary(name));
#else
		m_lib = dlopen(name, RTLD_NOW);
#endif
		if (!m_lib)
			return false;

		m_createInterface = Get<CreateInterfaceFn>("CreateInterface");
		return true;
	}

	bool IsOpen() const
	{
		return m_lib != nullptr;
	}

	void *Get(const char *name) const
	{
		if (!m_lib)
			return nullptr;
#ifdef _WIN32
		return reinterpret_cast<void *>(GetProcAddress(reinterpret_cast<HMODULE>(m_lib), name));
#else
		return dlsym(m_lib, name);
#endif
	}

	template<typename T>
	    requires(std::is_pointer_v<T>)
	T Get(const char *name) const
	{
		return reinterpret_cast<T>(Get(name));
	}

	void *CreateInterface(const char *name) const
	{
		if (!m_createInterface)
			return nullptr;
		return m_createInterface(name, nullptr);
	}

	template<typename T>
	    requires(std::is_pointer_v<T>)
	T CreateInterface(const char *name) const
	{
		return reinterpret_cast<T>(CreateInterface(name));
	}
};
