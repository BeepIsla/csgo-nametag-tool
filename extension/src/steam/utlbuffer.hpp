#pragma once

#include <bit>

class CByteswap
{
public:
	unsigned int m_bSwapBytes : 1;
	unsigned int m_bBigEndian : 1;

public:
	CByteswap()
	{
		SetTargetBigEndian(IsMachineBigEndian());
	}

	inline bool IsMachineBigEndian()
	{
		return std::endian::native == std::endian::big;
	}

	inline void SetTargetBigEndian(bool bigEndian)
	{
		m_bBigEndian = bigEndian;
		m_bSwapBytes = IsMachineBigEndian() != bigEndian;
	}
};
static_assert(sizeof(CByteswap) == 4);

template<typename T>
class CUtlMemory
{
public:
	T  *m_pMemory;
	int m_nAllocationCount;
	int m_nGrowSize;

public:
	CUtlMemory(int nGrowSize = 0, int nInitAllocationCount = 0)
	    : m_pMemory(0),
	      m_nAllocationCount(nInitAllocationCount),
	      m_nGrowSize(nGrowSize)
	{
	}
};
static_assert(sizeof(CUtlMemory<void>) == 16);

class CUtlBuffer
{
public:
	typedef bool (*UtlBufferOverflowFunc_t)(int nSize);

public:
	CUtlMemory<unsigned char> m_Memory;
	int                       m_Get;
	int                       m_Put;

	unsigned char m_Error;
	unsigned char m_Flags;
	unsigned char m_Reserved;

	int m_nTab;
	int m_nMaxPut;
	int m_nOffset;

	UtlBufferOverflowFunc_t m_GetOverflowFunc;
	UtlBufferOverflowFunc_t m_PutOverflowFunc;

	CByteswap m_Byteswap;

public:
	CUtlBuffer(int growSize = 0, int initSize = 0, int nFlags = 0)
	    : m_Error(0),
	      m_Memory(growSize, initSize)
	{
		m_Get     = 0;
		m_Put     = 0;
		m_nTab    = 0;
		m_nOffset = 0;
		m_Flags   = nFlags;
		if ((initSize != 0) && (m_Flags & 8) == 0)
		{
			m_nMaxPut = -1;
			if (m_Put > m_nMaxPut)
				m_nMaxPut = m_Put;
		}
		else
		{
			m_nMaxPut = 0;
		}

		m_GetOverflowFunc = [](int nSize) -> bool {
			return false;
		};
		m_PutOverflowFunc = [](int nSize) -> bool {
			return false;
		};
	}
};
static_assert(sizeof(CUtlBuffer) == 64);
