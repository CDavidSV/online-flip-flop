import React from "react";
import "./FlipFlopLoader.css";

export default function FlipFlopLoader() {
    return (
        <div className='flipflop-loader' role='status' aria-label='Loading'>
            <div className='piece'>
                <span className='face front'>
                    <span className='symbol plus md:mb-1'>+</span>
                </span>
                <span className='face back'>
                    <span className='symbol times md:mb-1'>×</span>
                </span>
            </div>

            <div className='piece' style={{ animationDelay: "0.22s" }}>
                <span className='face front'>
                    <span className='symbol times md:mb-1'>×</span>
                </span>
                <span className='face back'>
                    <span className='symbol plus md:mb-1'>+</span>
                </span>
            </div>

            <div className='piece' style={{ animationDelay: "0.44s" }}>
                <span className='face front'>
                    <span className='symbol plus md:mb-1'>+</span>
                </span>
                <span className='face back'>
                    <span className='symbol times md:mb-1'>×</span>
                </span>
            </div>

            <div className='piece' style={{ animationDelay: "0.66s" }}>
                <span className='face front'>
                    <span className='symbol times md:mb-1'>×</span>
                </span>
                <span className='face back'>
                    <span className='symbol plus md:mb-1'>+</span>
                </span>
            </div>
        </div>
    );
}
