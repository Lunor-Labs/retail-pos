import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
    style?: React.CSSProperties;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    className = '',
    style,
}: PaginationProps) {
    const [jumpPage, setJumpPage] = useState('');

    useEffect(() => {
        setJumpPage('');
    }, [currentPage]);

    if (totalPages <= 1) return null;

    const handleJumpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const pageNum = parseInt(jumpPage);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            onPageChange(pageNum);
            setJumpPage('');
        }
    };

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const showMax = 5;
        if (totalPages <= showMax) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }
        return pages;
    };

    const btnBase: React.CSSProperties = { width: 28, height: 28, padding: 0, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 500, cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' };

    return (
        <div className={`flex items-center justify-between gap-4 flex-wrap ${className}`} style={style}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-sm"
                    style={{ height: 28, padding: '0 8px', opacity: currentPage === 1 ? 0.4 : 1 }}
                    title="Previous"
                >
                    <ChevronLeft size={14} /> Prev
                </button>

                {getPageNumbers().map((pageNum, idx) => (
                    <React.Fragment key={idx}>
                        {pageNum === '...' ? (
                            <span style={{ fontSize: 12, color: 'var(--faint)', padding: '0 4px' }}>…</span>
                        ) : (
                            <button
                                onClick={() => onPageChange(pageNum as number)}
                                style={{
                                    ...btnBase,
                                    background: currentPage === pageNum ? 'var(--ink)' : 'var(--panel)',
                                    color: currentPage === pageNum ? '#fff' : 'var(--ink-2)',
                                    borderColor: currentPage === pageNum ? 'var(--ink)' : 'var(--line)',
                                    fontWeight: currentPage === pageNum ? 600 : 500,
                                }}
                            >
                                {pageNum}
                            </button>
                        )}
                    </React.Fragment>
                ))}

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-sm"
                    style={{ height: 28, padding: '0 8px', opacity: currentPage === totalPages ? 0.4 : 1 }}
                    title="Next"
                >
                    Next <ChevronRight size={14} />
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Jump to:</span>
                <form onSubmit={handleJumpSubmit} style={{ display: 'flex', gap: 4 }}>
                    <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        style={{ width: 48, height: 28, padding: '0 6px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12, textAlign: 'center', background: 'var(--panel)', color: 'var(--ink)', outline: 'none' }}
                        placeholder={currentPage.toString()}
                    />
                    <button type="submit" className="btn btn-sm" style={{ height: 28 }}>Go</button>
                </form>
            </div>
        </div>
    );
}
